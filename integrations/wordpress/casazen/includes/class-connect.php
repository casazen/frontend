<?php
/**
 * «Connect to CasaZen»: the site gets a credential of its own from the account of the agency, and «Disconnect» gives it back.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * The connection of the site to the CasaZen account of the agency (OAuth-like, with PKCE S256):
 *
 * 1. Start (`admin-post.php?action=casazen_connect`, capability and nonce): reads where the API is from the manifest of the console,
 *    makes a `state` (32 random bytes, hexadecimal) and a PKCE `verifier` (32 random bytes, base64url), keeps them for 15 minutes in a
 *    transient of the user, and sends the browser to `<console>/app/connect/wordpress?site=…&return=…&state=…&challenge=…&method=S256`.
 * 2. In the console the administrator of the agency confirms; CasaZen sends the browser back to the screen of the plugin with
 *    `casazen_code` and `state`.
 * 3. Return (on the screen of the plugin, capability): the state is compared with hash_equals() and used once, the code is exchanged
 *    from the server (`POST /api/public/site-connections/token`, with the verifier and the origin of the site), the account is read
 *    (`GET /api/site/v1/account`), the link is stored (Link) and the address and the slug of the settings are filled in. Any failure
 *    shows one message and stores nothing; the browser always lands on the screen without the code in its address.
 *
 * The state is the nonce of the return: the return comes from CasaZen, which cannot know a nonce of WordPress.
 */
class Connect {

	/**
	 * Action and nonce of the «Connect to CasaZen» form.
	 *
	 * @var string
	 */
	const START_ACTION = 'casazen_connect';

	/**
	 * Action and nonce of the «Disconnect» form.
	 *
	 * @var string
	 */
	const DISCONNECT_ACTION = 'casazen_disconnect';

	/**
	 * The request that waits for its return is kept in a transient named with this prefix and the id of the user.
	 *
	 * @var string
	 */
	const PENDING_PREFIX = 'casazen_connect_';

	/**
	 * How long a request waits for its return (15 minutes).
	 *
	 * @var int
	 */
	const PENDING_TTL = 15 * MINUTE_IN_SECONDS;

	/**
	 * The page of the console where the administrator confirms the connection.
	 *
	 * @var string
	 */
	const CONSOLE_PATH = '/app/connect/wordpress';

	/**
	 * The query parameter of the code in the return.
	 *
	 * @var string
	 */
	const CODE_PARAM = 'casazen_code';

	/**
	 * The query parameter of the state in the return.
	 *
	 * @var string
	 */
	const STATE_PARAM = 'state';

	/**
	 * A code of CasaZen: random bytes in base64url.
	 *
	 * @var string
	 */
	const CODE_PATTERN = '/^[A-Za-z0-9_-]{16,512}$/D';

	/**
	 * A state of this plugin: 32 bytes in hexadecimal.
	 *
	 * @var string
	 */
	const STATE_PATTERN = '/^[0-9a-f]{64}$/D';

	/**
	 * Hooks the two forms into admin-post (only called in the admin). The return is handled by Admin::on_load_page().
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_post_' . self::START_ACTION, array( __CLASS__, 'handle_start' ) );
		add_action( 'admin_post_' . self::DISCONNECT_ACTION, array( __CLASS__, 'handle_disconnect' ) );
	}

	/**
	 * The «Connect to CasaZen» form: capability and nonce, then the browser goes to the console (or back to the screen with the
	 * reason why it cannot).
	 *
	 * @return void
	 */
	public static function handle_start() {
		Admin::check_request( self::START_ACTION );

		$start = self::start();
		if ( ! $start['ok'] ) {
			Admin::flash( 'error', $start['message'] );
			Admin::redirect_to_page();
			return;
		}

		// The console is another host: wp_safe_redirect() goes there because the plugin itself allows that one host, for this redirect.
		$host = wp_parse_url( $start['url'], PHP_URL_HOST );
		add_filter(
			'allowed_redirect_hosts',
			static function ( $hosts ) use ( $host ) {
				$hosts   = is_array( $hosts ) ? $hosts : array();
				$hosts[] = $host;
				return $hosts;
			}
		);
		wp_safe_redirect( $start['url'] );
		exit;
	}

	/**
	 * Prepares a connection for the current user and returns the address of the console.
	 *
	 * @return array { ok: bool, url: string, message: string } `message` says why it cannot start.
	 */
	public static function start() {
		$site = self::site_origin();
		if ( '' === $site ) {
			return self::refusal( __( 'CasaZen can connect a site whose address starts with https:// and whose administration is on the same address. Use the manual set-up under Advanced.', 'casazen' ) );
		}

		$app_origin = Build_Config::app_origin();
		$api_base   = Connection::read_api_base( $app_origin );
		if ( '' === $api_base ) {
			return self::refusal( Api_Client::message( 'unreachable' ) );
		}

		try {
			$state    = bin2hex( random_bytes( 32 ) );
			$verifier = self::base64url( random_bytes( 32 ) );
		} catch ( \Exception $error ) {
			return self::refusal( Api_Client::message( 'unexpected' ) );
		}

		set_transient(
			self::pending_key(),
			array(
				'state'      => $state,
				'verifier'   => $verifier,
				'site'       => $site,
				'app_origin' => $app_origin,
				'api_base'   => $api_base,
			),
			self::PENDING_TTL
		);

		$query = http_build_query(
			array(
				'site'      => $site,
				'return'    => self::return_url(),
				'state'     => $state,
				'challenge' => self::challenge( $verifier ),
				'method'    => 'S256',
			),
			'',
			'&',
			PHP_QUERY_RFC3986
		);
		return array(
			'ok'      => true,
			'url'     => $app_origin . self::CONSOLE_PATH . '?' . $query,
			'message' => '',
		);
	}

	/**
	 * The return from the console, on the screen of the plugin (before anything is printed): runs only when the address carries the
	 * code, exchanges it, and always comes back to the screen without the code in its address.
	 *
	 * @return void
	 */
	public static function maybe_handle_return() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- the return comes from CasaZen: its nonce is the state, checked with hash_equals() in finish().
		if ( ! isset( $_GET[ self::CODE_PARAM ] ) ) {
			return;
		}
		if ( ! current_user_can( Admin::CAPABILITY ) ) {
			wp_die(
				esc_html__( 'You do not have permission to do this.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}

		$result = self::finish( self::query_value( self::CODE_PARAM ), self::query_value( self::STATE_PARAM ) );
		if ( $result['ok'] ) {
			/* translators: %s: the name of the agency in CasaZen. */
			Admin::flash( 'success', sprintf( __( 'Connected to %s.', 'casazen' ), $result['org_name'] ), Admin::NEXT_SETUP );
		} else {
			Admin::flash( 'error', $result['message'] );
		}
		Admin::redirect_to_page();
	}

	/**
	 * Completes a connection: checks the state, exchanges the code, reads the account and stores the link.
	 *
	 * @param string $code  The code that CasaZen gave.
	 * @param string $state The state that came back with it.
	 * @return array { ok: bool, message: string, org_name: string }
	 */
	public static function finish( $code, $state ) {
		$key     = self::pending_key();
		$pending = get_transient( $key );
		// One use: whatever happens next, this request is spent.
		delete_transient( $key );

		if (
			! self::is_pending( $pending )
			|| ! is_string( $state )
			|| 1 !== preg_match( self::STATE_PATTERN, $state )
			|| ! hash_equals( $pending['state'], $state )
		) {
			return self::refusal( __( 'This connection request is not valid any more. Press Connect to CasaZen again.', 'casazen' ) );
		}
		if ( ! is_string( $code ) || 1 !== preg_match( self::CODE_PATTERN, $code ) ) {
			return self::refusal( Api_Client::message( 'invalid_grant' ) );
		}

		$reply = Api_Client::request(
			$pending['api_base'],
			'POST',
			'/public/site-connections/token',
			'',
			array(
				'code'         => $code,
				'codeVerifier' => $pending['verifier'],
				'siteUrl'      => $pending['site'],
			)
		);
		if ( ! $reply['ok'] ) {
			return self::refusal( Api_Client::message( $reply['error'] ) );
		}
		$grant = self::read_grant( $reply['data'] );
		if ( null === $grant ) {
			return self::refusal( Api_Client::message( 'unexpected' ) );
		}

		$reply   = Api_Client::request( $pending['api_base'], 'GET', '/site/v1/account', $grant['token'] );
		$account = $reply['ok'] ? Account::read( $reply['data'] ) : null;
		if ( null === $account || $account['org_id'] !== $grant['org_id'] ) {
			// The credential exists but cannot be used: CasaZen is asked to revoke it, so that nothing is left behind.
			Api_Client::request( $pending['api_base'], 'DELETE', '/site/v1/connection', $grant['token'] );
			return self::refusal( Api_Client::message( $reply['ok'] ? 'unexpected' : $reply['error'] ) );
		}

		Link::save(
			array(
				'token'         => $grant['token'],
				'connection_id' => $grant['connection_id'],
				'org_slug'      => $account['org_slug'],
				'org_name'      => $account['org_name'],
				'site_url'      => $pending['site'],
				'app_origin'    => $pending['app_origin'],
				'api_base'      => $pending['api_base'],
				'connected_at'  => time(),
			)
		);
		Account::store( $account );
		// The new link has no address written yet: the address and the slug of the agency go into the settings, as they always did.
		if ( ! Account::follow_address( $account ) ) {
			// The address was already the right one: the connection test runs all the same, as after any connection.
			Connection::refresh();
		}

		return array(
			'ok'       => true,
			'message'  => '',
			'org_name' => $account['org_name'],
		);
	}

	/**
	 * The «Disconnect» form: capability and nonce, then the credential is given back and forgotten.
	 *
	 * @return void
	 */
	public static function handle_disconnect() {
		Admin::check_request( self::DISCONNECT_ACTION );

		if ( self::disconnect() ) {
			Admin::flash( 'success', __( 'This site is no longer connected to CasaZen. The address and the settings stay, so the widgets keep working.', 'casazen' ) );
		} else {
			Admin::flash( 'warning', __( 'This site is no longer connected, but CasaZen could not be told. If the site is still listed among the connected sites in the CasaZen console, remove it there.', 'casazen' ) );
		}
		Admin::redirect_to_page();
	}

	/**
	 * Asks CasaZen to revoke the credential (`DELETE /api/site/v1/connection`) and forgets the link in any case: an unreachable
	 * CasaZen never keeps the site connected.
	 *
	 * @return bool Whether CasaZen confirmed (or had already removed the connection).
	 */
	public static function disconnect() {
		$link      = Link::get();
		$confirmed = true;
		if ( null !== $link ) {
			$reply = Api_Client::request( $link['api_base'], 'DELETE', '/site/v1/connection', $link['token'] );
			// A 401: CasaZen had already removed the connection.
			$confirmed = $reply['ok'] || 'unauthorized' === $reply['error'];
		}
		Link::forget();
		Account::forget();
		return $confirmed;
	}

	/**
	 * The origin of this site, as CasaZen connects it: the origin of home_url(), when it is https (http only for a development
	 * host) and the administration is on the same origin (CasaZen sends the browser back to the administration of that origin).
	 *
	 * @return string The origin, or an empty string when the site cannot be connected.
	 */
	public static function site_origin() {
		$home  = Settings::normalise_address( home_url() );
		$admin = Settings::normalise_address( admin_url() );
		if ( is_wp_error( $home ) || is_wp_error( $admin ) || '' === $home || $home !== $admin ) {
			return '';
		}
		return $home;
	}

	/**
	 * Where CasaZen sends the browser back: the screen of the plugin.
	 *
	 * @return string
	 */
	public static function return_url() {
		return admin_url( 'options-general.php?page=' . Admin::PAGE_SLUG );
	}

	/**
	 * The PKCE challenge of a verifier: the SHA-256 of the verifier, in base64url without padding (S256).
	 *
	 * @param string $verifier The verifier.
	 * @return string
	 */
	public static function challenge( $verifier ) {
		return self::base64url( hash( 'sha256', (string) $verifier, true ) );
	}

	/**
	 * The name of the transient of the request of the current user.
	 *
	 * @return string
	 */
	public static function pending_key() {
		return self::PENDING_PREFIX . get_current_user_id();
	}

	/**
	 * Bytes in base64url without padding (RFC 4648 §5).
	 *
	 * @param string $bytes The bytes.
	 * @return string
	 */
	private static function base64url( $bytes ) {
		return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- base64url of random bytes and of a hash (PKCE), not obfuscation.
	}

	/**
	 * Whether a stored value is a request that waits for its return.
	 *
	 * @param mixed $pending The value of the transient.
	 * @return bool
	 */
	private static function is_pending( $pending ) {
		if ( ! is_array( $pending ) ) {
			return false;
		}
		foreach ( array( 'state', 'verifier', 'site', 'app_origin', 'api_base' ) as $key ) {
			if ( ! isset( $pending[ $key ] ) || ! is_string( $pending[ $key ] ) || '' === $pending[ $key ] ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Reads the answer of the exchange of the code.
	 *
	 * @param mixed $data The decoded answer.
	 * @return array|null { token, connection_id, org_id }, or null when the answer is not what CasaZen sends.
	 */
	private static function read_grant( $data ) {
		if ( ! is_array( $data ) || ! isset( $data['accessToken'], $data['connectionId'], $data['org'] ) || ! is_array( $data['org'] ) ) {
			return null;
		}
		if ( ! Link::is_token( $data['accessToken'] ) || ! Link::is_id( $data['connectionId'] ) || ! isset( $data['org']['id'] ) || ! Link::is_id( $data['org']['id'] ) ) {
			return null;
		}
		return array(
			'token'         => $data['accessToken'],
			'connection_id' => strtolower( $data['connectionId'] ),
			'org_id'        => strtolower( $data['org']['id'] ),
		);
	}

	/**
	 * A value of the address of the return, cleaned.
	 *
	 * @param string $name The query parameter.
	 * @return string
	 */
	private static function query_value( $name ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- see maybe_handle_return(): the state is the nonce of the return. A list is read as an empty text.
		return isset( $_GET[ $name ] ) ? sanitize_text_field( wp_unslash( $_GET[ $name ] ) ) : '';
	}

	/**
	 * A result that says why nothing happened.
	 *
	 * @param string $message The sentence for the administrator.
	 * @return array
	 */
	private static function refusal( $message ) {
		return array(
			'ok'       => false,
			'url'      => '',
			'message'  => $message,
			'org_name' => '',
		);
	}
}
