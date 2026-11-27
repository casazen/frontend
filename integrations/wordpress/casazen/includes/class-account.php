<?php
/**
 * The account of the agency as CasaZen gives it to a connected site: its address and its domain.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Reads `GET /api/site/v1/account` (and the same object in the answers of the domain endpoints), keeps a normalised copy for the
 * screen and applies the address of the agency to the settings.
 *
 * The copy (the transient `casazen_account`) holds only the fields read below, never the credential and never a raw answer. It is
 * refreshed when the screen of the plugin is opened (at most once a minute), by the refresh of the screen while a domain waits for
 * its DNS records (at most every 30 seconds) and by every action on the domain. Never by a public page.
 *
 * When `publicAddress` changes (the domain is verified, or it is removed) the address and the slug of the settings follow it, through
 * Settings::sanitize(), and the connection test runs again for them (Settings::on_update()).
 */
class Account {

	/**
	 * The transient of the copy of the account.
	 *
	 * @var string
	 */
	const CACHE = 'casazen_account';

	/**
	 * How long the copy is kept (a day): the screen asks CasaZen again long before.
	 *
	 * @var int
	 */
	const CACHE_TTL = DAY_IN_SECONDS;

	/**
	 * Seconds after which opening the screen asks CasaZen again.
	 *
	 * @var int
	 */
	const STALE_AFTER = MINUTE_IN_SECONDS;

	/**
	 * Seconds the refresh of the screen waits between two questions to CasaZen, whatever the browser asks (the script asks every 30).
	 *
	 * @var int
	 */
	const POLL_MIN_AGE = 25;

	/**
	 * The address of the agency is its own domain (the slug of the settings stays empty).
	 *
	 * @var string
	 */
	const KIND_CUSTOM_DOMAIN = 'customDomain';

	/**
	 * The address of the agency is the one of CasaZen (the slug says which agency).
	 *
	 * @var string
	 */
	const KIND_CASAZEN = 'casazen';

	/**
	 * The states of a domain that CasaZen sends.
	 *
	 * @var string[]
	 */
	const VERIFICATION_STATES = array( 'Pending', 'Verified', 'Failed' );

	/**
	 * The states of the sign-in of the owners on the domain that CasaZen sends.
	 *
	 * @var string[]
	 */
	const OWNER_LOGIN_STATES = array( 'NotRequested', 'Pending', 'Ready', 'Failed' );

	/**
	 * Reads an account of the API into the normalised copy.
	 *
	 * @param mixed $data The decoded answer.
	 * @return array|null { connection_id, org_id, org_slug, org_name, embed_enabled, public_address, public_address_kind, domain },
	 *                    or null when the answer is not an account.
	 */
	public static function read( $data ) {
		if ( ! is_array( $data ) || ! isset( $data['org'] ) || ! is_array( $data['org'] ) ) {
			return null;
		}
		$org  = $data['org'];
		$slug = isset( $org['slug'] ) ? Settings::normalise_slug( $org['slug'] ) : false;
		$name = isset( $org['displayName'] ) ? self::text( $org['displayName'], 200 ) : '';
		if ( ! isset( $org['id'] ) || ! Link::is_id( $org['id'] ) || false === $slug || '' === $slug || '' === $name ) {
			return null;
		}

		$address = isset( $data['publicAddress'] ) ? Settings::normalise_address( $data['publicAddress'] ) : '';
		$kind    = isset( $data['publicAddressKind'] ) ? $data['publicAddressKind'] : '';
		if ( is_wp_error( $address ) || '' === $address || ! in_array( $kind, array( self::KIND_CUSTOM_DOMAIN, self::KIND_CASAZEN ), true ) ) {
			return null;
		}

		$domain = isset( $data['domain'] ) ? self::read_domain( $data['domain'] ) : null;
		if ( null === $domain ) {
			return null;
		}

		return array(
			'connection_id'       => ( isset( $data['connectionId'] ) && Link::is_id( $data['connectionId'] ) ) ? $data['connectionId'] : '',
			'org_id'              => strtolower( $org['id'] ),
			'org_slug'            => $slug,
			'org_name'            => $name,
			'embed_enabled'       => ( isset( $data['embedEnabled'] ) && is_bool( $data['embedEnabled'] ) ) ? $data['embedEnabled'] : null,
			'public_address'      => $address,
			'public_address_kind' => $kind,
			'domain'              => $domain,
		);
	}

	/**
	 * The copy of the account, or null when there is none.
	 *
	 * @return array|null The account of read() plus `fetched_at` (when CasaZen was last asked) and `error` (the code of the last
	 *                    question that failed, or an empty string).
	 */
	public static function cached() {
		$value = get_transient( self::CACHE );
		if (
			! is_array( $value )
			|| ! isset( $value['fetched_at'], $value['error'], $value['org_name'], $value['org_slug'], $value['public_address'], $value['public_address_kind'], $value['domain'] )
			|| ! is_array( $value['domain'] )
			|| ! isset( $value['domain']['custom_domain'], $value['domain']['verification'], $value['domain']['status'] )
		) {
			return null;
		}
		return $value;
	}

	/**
	 * Keeps a copy of the account.
	 *
	 * @param array  $account The account of read().
	 * @param string $error   The code of a question that failed after it (the copy is then the last good one), or an empty string.
	 * @return void
	 */
	public static function store( array $account, $error = '' ) {
		$account['fetched_at'] = time();
		$account['error']      = (string) $error;
		set_transient( self::CACHE, $account, self::CACHE_TTL );
	}

	/**
	 * Drops the copy of the account.
	 *
	 * @return void
	 */
	public static function forget() {
		delete_transient( self::CACHE );
	}

	/**
	 * CasaZen no longer accepts the credential (a 401): the link and the copy go, the settings stay as they are.
	 *
	 * @return void
	 */
	public static function revoke() {
		Link::mark_revoked();
		self::forget();
	}

	/**
	 * CasaZen answered that the plan has no custom domain: the copy says so, so the screen shows the Pro message instead of the form
	 * and no check of the domain is asked for.
	 *
	 * @return void
	 */
	public static function mark_plan_required() {
		$cached = self::cached();
		if ( null === $cached ) {
			return;
		}
		$cached['domain']['can_use_custom_domain'] = false;
		set_transient( self::CACHE, $cached, self::CACHE_TTL );
	}

	/**
	 * Asks CasaZen for the account, unless the copy is younger than `$min_age` seconds.
	 *
	 * A 401 means CasaZen no longer accepts the credential: the link is dropped (Link::mark_revoked()) and the settings stay as they
	 * are. Another failure keeps the last copy and remembers the failure, so the screen can say that the data may be old.
	 *
	 * @param int $min_age Seconds: a copy younger than this is used without asking (0 always asks).
	 * @return array { ok: bool, error: string, account: array|null, asked: bool }
	 */
	public static function refresh( $min_age = 0 ) {
		$link = Link::get();
		if ( null === $link ) {
			return self::outcome( false, 'unauthorized', null, false );
		}
		$cached = self::cached();
		if ( null !== $cached && $min_age > 0 && ( time() - (int) $cached['fetched_at'] ) < $min_age ) {
			return self::outcome( '' === $cached['error'], $cached['error'], $cached, false );
		}

		$reply = Api_Client::request( $link['api_base'], 'GET', '/site/v1/account', $link['token'] );
		return self::accept_reply( $reply, $reply['ok'] ? $reply['data'] : null );
	}

	/**
	 * Takes the answer of an endpoint that answers the account (or carries it): keeps the copy and applies the address, or handles
	 * the failure (a 401 drops the link; anything else keeps the last copy and remembers the failure).
	 *
	 * @param array $reply   The result of Api_Client::request().
	 * @param mixed $account The decoded account of the answer (for `POST domain/verify`, its member `account`).
	 * @return array { ok: bool, error: string, account: array|null, asked: true }
	 */
	public static function accept_reply( array $reply, $account ) {
		if ( ! $reply['ok'] ) {
			return self::fail( $reply['error'] );
		}
		$read = self::read( $account );
		if ( null === $read ) {
			return self::fail( 'unexpected' );
		}
		self::accept( $read );
		return self::outcome( true, '', self::cached(), true );
	}

	/**
	 * A good account: keeps the copy, the name of the agency in the link, and the address in the settings.
	 *
	 * @param array $account The account of read().
	 * @return void
	 */
	public static function accept( array $account ) {
		self::store( $account );
		Link::update_org( $account['org_name'], $account['org_slug'] );
		self::apply_address( $account );
	}

	/**
	 * The address and the slug that the settings take from an account: the address of the agency, and the slug only on the address
	 * of CasaZen (on its own domain the host says which agency it is).
	 *
	 * @param array $account The account of read().
	 * @return array { address, org_slug }
	 */
	public static function settings_for( array $account ) {
		return array(
			'address'  => $account['public_address'],
			'org_slug' => self::KIND_CUSTOM_DOMAIN === $account['public_address_kind'] ? '' : $account['org_slug'],
		);
	}

	/**
	 * Writes the address and the slug of an account into the settings, through Settings::sanitize() (the option is registered with
	 * it), when they differ. Settings::on_update() then drops the old result of the connection test and runs one for the new values.
	 *
	 * @param array $account The account of read().
	 * @return bool Whether the settings changed.
	 */
	public static function apply_address( array $account ) {
		$wanted  = self::settings_for( $account );
		$current = Settings::get();
		if ( $current['address'] === $wanted['address'] && $current['org_slug'] === $wanted['org_slug'] ) {
			return false;
		}
		update_option( Settings::OPTION, array_merge( $current, $wanted ) );
		$saved = Settings::get();
		return $saved['address'] === $wanted['address'] && $saved['org_slug'] === $wanted['org_slug'];
	}

	/**
	 * The state of the domain as the screen shows it.
	 *
	 * @param array|null $account The copy of the account.
	 * @return string `none` (no domain of its own), `verified`, `waiting` (waiting for the DNS records), `activating` (the records
	 *                are not the problem: the platform finishes the activation by itself) or `failed`.
	 */
	public static function domain_state( $account ) {
		if ( ! is_array( $account ) || '' === $account['domain']['custom_domain'] ) {
			return 'none';
		}
		$domain = $account['domain'];
		if ( 'Verified' === $domain['verification'] ) {
			return 'verified';
		}
		if ( 'Failed' === $domain['verification'] ) {
			return 'failed';
		}
		$platform = array( 'vercel_not_configured', 'vercel_unauthorized', 'vercel_unavailable' );
		return in_array( $domain['status']['detail'], $platform, true ) ? 'activating' : 'waiting';
	}

	/**
	 * Whether the screen refreshes the state by itself: a domain of its own that waits for CasaZen to verify it.
	 *
	 * @param array|null $account The copy of the account.
	 * @return bool
	 */
	public static function is_pending( $account ) {
		return in_array( self::domain_state( $account ), array( 'waiting', 'activating' ), true );
	}

	/**
	 * A short fingerprint of what the screen shows of the account (not the time of the last check): the script of the screen
	 * reloads the page when it changes.
	 *
	 * @param array|null $account The copy of the account.
	 * @return string
	 */
	public static function fingerprint( $account ) {
		if ( ! is_array( $account ) ) {
			return 'none';
		}
		$shown = $account;
		unset( $shown['fetched_at'], $shown['error'] );
		$shown['domain']['status']['checked_at'] = '';
		return substr( md5( (string) wp_json_encode( $shown ) ), 0, 16 );
	}

	/**
	 * Reads the domain settings of the account (the object of `GET /api/orgs/{orgId}/domain` of the console).
	 *
	 * @param mixed $data The decoded `domain`.
	 * @return array|null
	 */
	private static function read_domain( $data ) {
		if ( ! is_array( $data ) ) {
			return null;
		}
		$verification = isset( $data['domainVerificationStatus'] ) ? $data['domainVerificationStatus'] : '';
		if ( ! in_array( $verification, self::VERIFICATION_STATES, true ) ) {
			return null;
		}
		$custom = ( isset( $data['customDomain'] ) && is_string( $data['customDomain'] ) ) ? strtolower( trim( $data['customDomain'] ) ) : '';
		if ( '' !== $custom && 1 !== preg_match( Settings::HOST_PATTERN, $custom ) ) {
			return null;
		}
		$status = ( isset( $data['status'] ) && is_array( $data['status'] ) ) ? $data['status'] : array();
		$urls   = ( isset( $data['publicUrls'] ) && is_array( $data['publicUrls'] ) ) ? $data['publicUrls'] : array();

		return array(
			'host_mode'             => isset( $data['publicHostMode'] ) && is_string( $data['publicHostMode'] ) ? self::text( $data['publicHostMode'], 40 ) : '',
			'custom_domain'         => $custom,
			'verification'          => $verification,
			'can_use_custom_domain' => isset( $data['canUseCustomDomain'] ) && true === $data['canUseCustomDomain'],
			'dns'                   => isset( $data['dnsInstructions'] ) ? self::read_dns( $data['dnsInstructions'] ) : null,
			'status'                => array(
				'detail'               => isset( $status['detail'] ) ? self::text( $status['detail'], 60 ) : '',
				'message'              => isset( $status['message'] ) ? self::text( $status['message'], 500 ) : '',
				'checked_at'           => isset( $status['checkedAt'] ) ? self::text( $status['checkedAt'], 40 ) : '',
				'verified_at'          => isset( $status['verifiedAt'] ) ? self::text( $status['verifiedAt'], 40 ) : '',
				'activation_available' => ! isset( $status['activationAvailable'] ) || false !== $status['activationAvailable'],
				'auto_check_active'    => isset( $status['autoCheckActive'] ) && true === $status['autoCheckActive'],
			),
			'custom_domain_url'     => isset( $urls['customDomainUrl'] ) ? self::text( $urls['customDomainUrl'], 300 ) : '',
			'surfaces'              => isset( $data['surfaces'] ) ? self::read_surfaces( $data['surfaces'] ) : null,
		);
	}

	/**
	 * Reads the DNS records to create.
	 *
	 * @param mixed $data The decoded `dnsInstructions`.
	 * @return array|null { cname_host, cname_target, txt_host, txt_value, a_records: string[], provider_txt_host, provider_txt_value }
	 */
	private static function read_dns( $data ) {
		if ( ! is_array( $data ) ) {
			return null;
		}
		$dns = array(
			'cname_host'         => isset( $data['cnameHost'] ) ? self::text( $data['cnameHost'], 255 ) : '',
			'cname_target'       => isset( $data['cnameTarget'] ) ? self::text( $data['cnameTarget'], 255 ) : '',
			'txt_host'           => isset( $data['txtHost'] ) ? self::text( $data['txtHost'], 255 ) : '',
			'txt_value'          => isset( $data['txtValue'] ) ? self::text( $data['txtValue'], 500 ) : '',
			'a_records'          => array(),
			'provider_txt_host'  => isset( $data['vercelTxtHost'] ) ? self::text( $data['vercelTxtHost'], 255 ) : '',
			'provider_txt_value' => isset( $data['vercelTxtValue'] ) ? self::text( $data['vercelTxtValue'], 500 ) : '',
		);
		if ( isset( $data['aRecordValues'] ) && is_array( $data['aRecordValues'] ) ) {
			foreach ( array_slice( $data['aRecordValues'], 0, 8 ) as $address ) {
				$address = self::text( $address, 64 );
				if ( '' !== $address ) {
					$dns['a_records'][] = $address;
				}
			}
		}
		return ( '' === $dns['cname_host'] && '' === $dns['txt_host'] ) ? null : $dns;
	}

	/**
	 * Reads what passes from the domain and the state of the sign-in of the owners.
	 *
	 * @param mixed $data The decoded `surfaces` (null while CasaZen has them off).
	 * @return array|null
	 */
	private static function read_surfaces( $data ) {
		if ( ! is_array( $data ) ) {
			return null;
		}
		$effective = ( isset( $data['effective'] ) && is_array( $data['effective'] ) ) ? $data['effective'] : array();
		$state     = isset( $data['ownerLoginHostState'] ) ? $data['ownerLoginHostState'] : '';
		return array(
			'guest_area'      => isset( $data['guestAreaOnOwnDomain'] ) && true === $data['guestAreaOnOwnDomain'],
			'owner_portal'    => isset( $data['ownerPortalOnOwnDomain'] ) && true === $data['ownerPortalOnOwnDomain'],
			'links'           => isset( $data['useOwnDomainForLinks'] ) && true === $data['useOwnDomainForLinks'],
			'owner_login'     => in_array( $state, self::OWNER_LOGIN_STATES, true ) ? $state : 'NotRequested',
			'owner_automatic' => isset( $data['ownerLoginAutomatic'] ) && true === $data['ownerLoginAutomatic'],
			'effective'       => array(
				'guest_area'   => isset( $effective['guestArea'] ) && true === $effective['guestArea'],
				'owner_portal' => isset( $effective['ownerPortal'] ) && true === $effective['ownerPortal'],
				'owner_login'  => isset( $effective['ownerLoginReady'] ) && true === $effective['ownerLoginReady'],
				'links'        => isset( $effective['linksOnOwnDomain'] ) && true === $effective['linksOnOwnDomain'],
			),
		);
	}

	/**
	 * A failed question: a 401 drops the link, anything else keeps the last copy with the failure.
	 *
	 * @param string $error The code of the failure.
	 * @return array
	 */
	private static function fail( $error ) {
		if ( 'unauthorized' === $error ) {
			self::revoke();
			return self::outcome( false, $error, null, true );
		}
		$cached = self::cached();
		if ( null !== $cached ) {
			unset( $cached['fetched_at'], $cached['error'] );
			self::store( $cached, $error );
		}
		return self::outcome( false, $error, self::cached(), true );
	}

	/**
	 * The result of a refresh.
	 *
	 * @param bool       $ok      Whether the account is the current one.
	 * @param string     $error   The code of the failure, or an empty string.
	 * @param array|null $account The copy of the account.
	 * @param bool       $asked   Whether CasaZen was asked.
	 * @return array
	 */
	private static function outcome( $ok, $error, $account, $asked ) {
		return array(
			'ok'      => (bool) $ok,
			'error'   => (string) $error,
			'account' => $account,
			'asked'   => (bool) $asked,
		);
	}

	/**
	 * A text of an answer, safe to keep: tags removed, trimmed and cut.
	 *
	 * @param mixed $value  The value.
	 * @param int   $length The longest accepted length.
	 * @return string
	 */
	private static function text( $value, $length ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return mb_substr( trim( wp_strip_all_tags( $value ) ), 0, $length );
	}
}
