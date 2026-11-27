<?php
/**
 * The domain of the agency, managed from the screen of the plugin once the site is connected.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * The actions of the section «Domain»: every one is a form of admin-post (capability and nonce, it works without JavaScript) and the
 * script of the screen adds the refresh of a domain that waits for its DNS records through admin-ajax (nonce and capability too).
 *
 * - Connect a domain: `PUT /api/site/v1/domain` with `{ "customDomain": "<domain>" }`;
 * - remove it: the same with `{ "customDomain": null }` (the agency goes back to the address of CasaZen);
 * - «Check now»: `POST /api/site/v1/domain/verify`, never while the plan has no custom domain;
 * - what passes from the domain: `PUT /api/site/v1/domain/surfaces`.
 *
 * Every answer carries the whole account: its copy is kept and the address of the settings follows `publicAddress` (Account). A 401
 * drops the link and the screen says «No longer connected».
 */
class Domain {

	/**
	 * Action and nonce of «Connect domain».
	 *
	 * @var string
	 */
	const SAVE_ACTION = 'casazen_domain_save';

	/**
	 * Action and nonce of «Remove domain».
	 *
	 * @var string
	 */
	const REMOVE_ACTION = 'casazen_domain_remove';

	/**
	 * Action and nonce of «Check now».
	 *
	 * @var string
	 */
	const VERIFY_ACTION = 'casazen_domain_verify';

	/**
	 * Action and nonce of the choices of what passes from the domain.
	 *
	 * @var string
	 */
	const SURFACES_ACTION = 'casazen_domain_surfaces';

	/**
	 * Action and nonce of «Reload the data» (when CasaZen could not be read).
	 *
	 * @var string
	 */
	const REFRESH_ACTION = 'casazen_account_refresh';

	/**
	 * The admin-ajax action of the refresh of the screen (wp_ajax_casazen_account).
	 *
	 * @var string
	 */
	const AJAX_ACCOUNT = 'casazen_account';

	/**
	 * The admin-ajax action of «Check now» with the script (wp_ajax_casazen_verify).
	 *
	 * @var string
	 */
	const AJAX_VERIFY = 'casazen_verify';

	/**
	 * The nonce of the two admin-ajax actions.
	 *
	 * @var string
	 */
	const AJAX_NONCE = 'casazen_ajax';

	/**
	 * The field of the domain in the form.
	 *
	 * @var string
	 */
	const DOMAIN_FIELD = 'casazen_domain';

	/**
	 * The fields of the three choices in the form.
	 *
	 * @var string
	 */
	const SURFACES_FIELD = 'casazen_surfaces';

	/**
	 * Hooks the forms into admin-post and the refresh into admin-ajax (only called in the admin).
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_post_' . self::SAVE_ACTION, array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_' . self::REMOVE_ACTION, array( __CLASS__, 'handle_remove' ) );
		add_action( 'admin_post_' . self::VERIFY_ACTION, array( __CLASS__, 'handle_verify' ) );
		add_action( 'admin_post_' . self::SURFACES_ACTION, array( __CLASS__, 'handle_surfaces' ) );
		add_action( 'admin_post_' . self::REFRESH_ACTION, array( __CLASS__, 'handle_refresh' ) );
		add_action( 'wp_ajax_' . self::AJAX_ACCOUNT, array( __CLASS__, 'ajax_account' ) );
		add_action( 'wp_ajax_' . self::AJAX_VERIFY, array( __CLASS__, 'ajax_verify' ) );
	}

	/**
	 * The form «Connect domain».
	 *
	 * @return void
	 */
	public static function handle_save() {
		Admin::check_request( self::SAVE_ACTION );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- the nonce was checked by Admin::check_request().
		$domain = isset( $_POST[ self::DOMAIN_FIELD ] ) ? sanitize_text_field( wp_unslash( $_POST[ self::DOMAIN_FIELD ] ) ) : '';
		self::finish( self::save( $domain ) );
	}

	/**
	 * The form «Remove domain».
	 *
	 * @return void
	 */
	public static function handle_remove() {
		Admin::check_request( self::REMOVE_ACTION );
		self::finish( self::remove() );
	}

	/**
	 * The form «Check now».
	 *
	 * @return void
	 */
	public static function handle_verify() {
		Admin::check_request( self::VERIFY_ACTION );
		self::finish( self::verify() );
	}

	/**
	 * The form of the three choices.
	 *
	 * @return void
	 */
	public static function handle_surfaces() {
		Admin::check_request( self::SURFACES_ACTION );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- the nonce was checked by Admin::check_request(); each value is read as a yes or no below.
		$posted = ( isset( $_POST[ self::SURFACES_FIELD ] ) && is_array( $_POST[ self::SURFACES_FIELD ] ) ) ? wp_unslash( $_POST[ self::SURFACES_FIELD ] ) : array();
		self::finish(
			self::set_surfaces(
				! empty( $posted['guest_area'] ),
				! empty( $posted['owner_portal'] ),
				! empty( $posted['links'] )
			)
		);
	}

	/**
	 * The form «Reload the data».
	 *
	 * @return void
	 */
	public static function handle_refresh() {
		Admin::check_request( self::REFRESH_ACTION );
		$outcome = Account::refresh();
		if ( $outcome['ok'] ) {
			self::finish( self::result( true, __( 'The data of CasaZen are up to date.', 'casazen' ) ) );
			return;
		}
		self::finish( self::result( false, Api_Client::message( $outcome['error'] ) ) );
	}

	/**
	 * Connects a domain of the agency.
	 *
	 * @param string $domain The domain as typed (`prenota.example.com`; an address such as `https://prenota.example.com/` is read too).
	 * @return array { ok: bool, message: string }
	 */
	public static function save( $domain ) {
		$link = Link::get();
		if ( null === $link ) {
			return self::result( false, Api_Client::message( 'unauthorized' ) );
		}
		$domain = self::normalise_domain( $domain );
		if ( '' === $domain ) {
			return self::result( false, Api_Client::message( 'domain_invalid' ) );
		}
		$reply = Api_Client::request( $link['api_base'], 'PUT', '/site/v1/domain', $link['token'], array( 'customDomain' => $domain ) );
		return self::after( $reply, $reply['ok'] ? $reply['data'] : null, __( 'Domain saved. Now create the DNS records shown below.', 'casazen' ) );
	}

	/**
	 * Removes the domain of the agency: its booking site goes back to the address of CasaZen.
	 *
	 * @return array { ok: bool, message: string }
	 */
	public static function remove() {
		$link = Link::get();
		if ( null === $link ) {
			return self::result( false, Api_Client::message( 'unauthorized' ) );
		}
		$reply = Api_Client::request( $link['api_base'], 'PUT', '/site/v1/domain', $link['token'], array( 'customDomain' => null ) );
		return self::after( $reply, $reply['ok'] ? $reply['data'] : null, __( 'The domain was removed: your booking site is back on the CasaZen address.', 'casazen' ) );
	}

	/**
	 * Asks CasaZen to check the domain now. Never while the plan has no custom domain, nor without a domain.
	 *
	 * @return array { ok: bool, message: string }
	 */
	public static function verify() {
		$link = Link::get();
		if ( null === $link ) {
			return self::result( false, Api_Client::message( 'unauthorized' ) );
		}
		$cached = Account::cached();
		if ( null !== $cached && ! $cached['domain']['can_use_custom_domain'] ) {
			return self::result( false, Api_Client::message( 'plan_required' ) );
		}
		if ( null !== $cached && '' === $cached['domain']['custom_domain'] ) {
			return self::result( false, Api_Client::message( 'domain_not_configured' ) );
		}

		$reply   = Api_Client::request( $link['api_base'], 'POST', '/site/v1/domain/verify', $link['token'] );
		$account = ( $reply['ok'] && is_array( $reply['data'] ) && isset( $reply['data']['account'] ) ) ? $reply['data']['account'] : null;
		$result  = self::after( $reply, $account, __( 'Your domain is active.', 'casazen' ) );
		if ( $result['ok'] && 'verified' !== Account::domain_state( Account::cached() ) ) {
			return self::result( true, __( 'Checked: the domain is not active yet. The state below says why.', 'casazen' ) );
		}
		return $result;
	}

	/**
	 * Saves what passes from the domain.
	 *
	 * @param bool $guest_area   The guest area on the domain.
	 * @param bool $owner_portal The owner portal on the domain.
	 * @param bool $links        The links of the e-mails on the domain.
	 * @return array { ok: bool, message: string }
	 */
	public static function set_surfaces( $guest_area, $owner_portal, $links ) {
		$link = Link::get();
		if ( null === $link ) {
			return self::result( false, Api_Client::message( 'unauthorized' ) );
		}
		$reply = Api_Client::request(
			$link['api_base'],
			'PUT',
			'/site/v1/domain/surfaces',
			$link['token'],
			array(
				'guestAreaOnOwnDomain'   => (bool) $guest_area,
				'ownerPortalOnOwnDomain' => (bool) $owner_portal,
				'useOwnDomainForLinks'   => (bool) $links,
			)
		);
		return self::after( $reply, $reply['ok'] ? $reply['data'] : null, __( 'Your choices were saved.', 'casazen' ) );
	}

	/**
	 * The refresh of the screen while a domain waits for its DNS records (admin-ajax, nonce and capability). CasaZen is asked at most
	 * once every Account::POLL_MIN_AGE seconds, whatever the browser asks.
	 *
	 * @return void
	 */
	public static function ajax_account() {
		self::check_ajax();
		Account::refresh( Account::POLL_MIN_AGE );
		wp_send_json_success( self::poll_state() );
	}

	/**
	 * «Check now» from the script (admin-ajax, nonce and capability). The message is kept as the form keeps it: the script reloads the
	 * page, which shows it with the new state.
	 *
	 * @return void
	 */
	public static function ajax_verify() {
		self::check_ajax();
		$result = self::verify();
		Admin::flash( $result['ok'] ? 'success' : 'error', $result['message'] );
		wp_send_json_success(
			array_merge(
				self::poll_state(),
				array(
					'ok'      => $result['ok'],
					'message' => $result['message'],
				)
			)
		);
	}

	/**
	 * What the script of the screen needs to know: whether to go on refreshing and whether the page shows old data. Nothing else
	 * leaves the server: never the credential, never the copy of the account.
	 *
	 * @return array { connected: bool, pending: bool, fingerprint: string, lastCheck: string }
	 */
	public static function poll_state() {
		$connected = Link::is_connected();
		$account   = $connected ? Account::cached() : null;
		return array(
			'connected'   => $connected,
			'pending'     => Account::is_pending( $account ),
			'fingerprint' => Account::fingerprint( $account ),
			'lastCheck'   => self::last_check( $account ),
		);
	}

	/**
	 * When CasaZen last checked the domain, as the screen shows it.
	 *
	 * @param array|null $account The copy of the account.
	 * @return string The date and time, or an empty string when the domain was never checked.
	 */
	public static function last_check( $account ) {
		if ( ! is_array( $account ) || '' === $account['domain']['status']['checked_at'] ) {
			return '';
		}
		$time = strtotime( $account['domain']['status']['checked_at'] );
		if ( false === $time ) {
			return '';
		}
		return wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $time );
	}

	/**
	 * A domain as CasaZen takes it: lower-case, without scheme, path or trailing dot; an empty string when it is not a host name.
	 *
	 * @param mixed $raw The domain as typed.
	 * @return string
	 */
	public static function normalise_domain( $raw ) {
		if ( ! is_string( $raw ) ) {
			return '';
		}
		$domain = strtolower( trim( $raw ) );
		$domain = (string) preg_replace( '#^[a-z][a-z0-9+.-]*://#', '', $domain );
		$domain = rtrim( (string) strtok( $domain, '/?#' ), '.' );
		if ( '' === $domain || strlen( $domain ) > 253 || false === strpos( $domain, '.' ) || 1 !== preg_match( Settings::HOST_PATTERN, $domain ) ) {
			return '';
		}
		return $domain;
	}

	/**
	 * Takes the answer of a domain endpoint: a good account is kept and applied; a 401 drops the link; `plan_required` hides the form.
	 *
	 * @param array  $reply   The result of Api_Client::request().
	 * @param mixed  $account The decoded account of the answer.
	 * @param string $success The sentence of a success.
	 * @return array { ok: bool, message: string }
	 */
	private static function after( array $reply, $account, $success ) {
		if ( ! $reply['ok'] ) {
			if ( 'unauthorized' === $reply['error'] ) {
				Account::revoke();
			} elseif ( 'plan_required' === $reply['error'] ) {
				Account::mark_plan_required();
			}
			$message = Api_Client::message( $reply['error'] );
			$detail  = 'domain_invalid' === $reply['error'] ? Api_Client::detail( $reply['data'] ) : '';
			return self::result( false, '' !== $detail ? $message . ' ' . $detail : $message );
		}

		$read = Account::read( $account );
		if ( null === $read ) {
			return self::result( false, Api_Client::message( 'unexpected' ) );
		}
		Account::accept( $read );
		return self::result( true, $success );
	}

	/**
	 * Shows the result of a form on the screen.
	 *
	 * @param array $result { ok: bool, message: string }.
	 * @return void
	 */
	private static function finish( array $result ) {
		Admin::flash( $result['ok'] ? 'success' : 'error', $result['message'] );
		Admin::redirect_to_page();
	}

	/**
	 * Refuses an admin-ajax request without its nonce or from a user who cannot manage options: nothing is asked of CasaZen.
	 *
	 * @return void
	 */
	private static function check_ajax() {
		if ( false === check_ajax_referer( self::AJAX_NONCE, 'nonce', false ) || ! current_user_can( Admin::CAPABILITY ) ) {
			wp_send_json_error( array( 'code' => 'forbidden' ), 403 );
		}
	}

	/**
	 * The result of an action.
	 *
	 * @param bool   $ok      Whether it worked.
	 * @param string $message The sentence for the administrator.
	 * @return array
	 */
	private static function result( $ok, $message ) {
		return array(
			'ok'      => (bool) $ok,
			'message' => (string) $message,
		);
	}
}
