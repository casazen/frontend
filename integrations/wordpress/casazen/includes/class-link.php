<?php
/**
 * The link of the site with the CasaZen account of the agency: the only secret of the plugin.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * The option `casazen_link` (autoload off, not registered with the Settings API, so never in a REST answer): what «Connect to
 * CasaZen» stored.
 *
 * - `token`: the credential of this site (`czs_…`). It is THE secret of the plugin: it is sent only in the `Authorization` header of
 *   the calls of Api_Client, from the server, and it is never printed in a page, an attribute, the data of a script, a notice, a log,
 *   an export or the message of an exception. No method of this class but get() returns it.
 * - `connection_id`, `org_slug`, `org_name`: the connection and the agency it belongs to.
 * - `site_url`: the origin of this site, as CasaZen confirmed it.
 * - `app_origin`, `api_base`: the console the site was connected with and the address of its API (read from its manifest).
 * - `connected_at`: when.
 *
 * When CasaZen no longer accepts the credential (a 401: the connection was removed in the console), the option keeps only a marker
 * `{ revoked_at, org_name }`: the credential is gone, and the screen can say «No longer connected».
 *
 * `casazen_settings` never holds any of this: the address and the slug that the connection fills in go there through
 * Settings::sanitize(), like the ones typed in the form.
 */
class Link {

	/**
	 * Name of the option.
	 *
	 * @var string
	 */
	const OPTION = 'casazen_link';

	/**
	 * What a credential of CasaZen looks like: `czs_` and random bytes in base64url.
	 *
	 * @var string
	 */
	const TOKEN_PATTERN = '/^czs_[A-Za-z0-9_-]{16,256}$/D';

	/**
	 * The id of a connection or of an organisation: a GUID.
	 *
	 * @var string
	 */
	const ID_PATTERN = '/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/D';

	/**
	 * The link, with its credential, or null while the site is not connected.
	 *
	 * Only the classes that call CasaZen read it: the screen reads summary().
	 *
	 * @return array|null { token, connection_id, org_slug, org_name, site_url, app_origin, api_base, connected_at }
	 */
	public static function get() {
		$stored = get_option( self::OPTION, null );
		if ( ! is_array( $stored ) || ! isset( $stored['token'] ) || ! self::is_token( $stored['token'] ) ) {
			return null;
		}
		$api_base = isset( $stored['api_base'] ) && is_string( $stored['api_base'] ) ? $stored['api_base'] : '';
		if ( '' === $api_base ) {
			return null;
		}
		return array(
			'token'         => $stored['token'],
			'connection_id' => self::string_field( $stored, 'connection_id' ),
			'org_slug'      => self::string_field( $stored, 'org_slug' ),
			'org_name'      => self::string_field( $stored, 'org_name' ),
			'site_url'      => self::string_field( $stored, 'site_url' ),
			'app_origin'    => self::string_field( $stored, 'app_origin' ),
			'api_base'      => $api_base,
			'connected_at'  => isset( $stored['connected_at'] ) ? (int) $stored['connected_at'] : 0,
		);
	}

	/**
	 * Whether the site is connected (a credential is stored).
	 *
	 * @return bool
	 */
	public static function is_connected() {
		return null !== self::get();
	}

	/**
	 * What the screen may show of the link: everything but the credential.
	 *
	 * @return array|null { org_slug, org_name, site_url, app_origin, connected_at }, or null while the site is not connected.
	 */
	public static function summary() {
		$link = self::get();
		if ( null === $link ) {
			return null;
		}
		unset( $link['token'], $link['api_base'], $link['connection_id'] );
		return $link;
	}

	/**
	 * Stores a new link (autoload off). The values were checked by the caller (Connect).
	 *
	 * @param array $link { token, connection_id, org_slug, org_name, site_url, app_origin, api_base, connected_at }.
	 * @return bool Whether it was stored.
	 */
	public static function save( array $link ) {
		if ( ! isset( $link['token'] ) || ! self::is_token( $link['token'] ) ) {
			return false;
		}
		$clean = array(
			'token'         => $link['token'],
			'connection_id' => self::string_field( $link, 'connection_id' ),
			'org_slug'      => self::string_field( $link, 'org_slug' ),
			'org_name'      => self::string_field( $link, 'org_name' ),
			'site_url'      => self::string_field( $link, 'site_url' ),
			'app_origin'    => self::string_field( $link, 'app_origin' ),
			'api_base'      => self::string_field( $link, 'api_base' ),
			'connected_at'  => isset( $link['connected_at'] ) ? (int) $link['connected_at'] : time(),
		);
		// A new option is created with autoload off; an option that already exists is replaced, and its autoload set off again.
		delete_option( self::OPTION );
		return add_option( self::OPTION, $clean, '', false );
	}

	/**
	 * Keeps the name and the slug of the agency as CasaZen says them now (the credential does not change).
	 *
	 * @param string $org_name The name of the agency.
	 * @param string $org_slug The slug of the agency.
	 * @return void
	 */
	public static function update_org( $org_name, $org_slug ) {
		$link = self::get();
		if ( null === $link || ( $link['org_name'] === $org_name && $link['org_slug'] === $org_slug ) ) {
			return;
		}
		$link['org_name'] = (string) $org_name;
		$link['org_slug'] = (string) $org_slug;
		self::save( $link );
	}

	/**
	 * CasaZen no longer accepts the credential: it is dropped, and a marker says which agency the site was connected to.
	 *
	 * @return void
	 */
	public static function mark_revoked() {
		$link = self::get();
		$name = null !== $link ? $link['org_name'] : '';
		delete_option( self::OPTION );
		add_option(
			self::OPTION,
			array(
				'revoked_at' => time(),
				'org_name'   => $name,
			),
			'',
			false
		);
	}

	/**
	 * The agency of a connection that CasaZen no longer accepts.
	 *
	 * @return string|null The name of the agency (it may be empty), or null when no connection was lost.
	 */
	public static function revoked() {
		$stored = get_option( self::OPTION, null );
		if ( ! is_array( $stored ) || ! isset( $stored['revoked_at'] ) || isset( $stored['token'] ) ) {
			return null;
		}
		return self::string_field( $stored, 'org_name' );
	}

	/**
	 * Removes the link (and the marker of a lost one).
	 *
	 * @return void
	 */
	public static function forget() {
		delete_option( self::OPTION );
	}

	/**
	 * Whether a value is a credential of CasaZen.
	 *
	 * @param mixed $value The value.
	 * @return bool
	 */
	public static function is_token( $value ) {
		return is_string( $value ) && 1 === preg_match( self::TOKEN_PATTERN, $value );
	}

	/**
	 * Whether a value is a GUID.
	 *
	 * @param mixed $value The value.
	 * @return bool
	 */
	public static function is_id( $value ) {
		return is_string( $value ) && 1 === preg_match( self::ID_PATTERN, $value );
	}

	/**
	 * A text field of a stored array.
	 *
	 * @param array  $values The array.
	 * @param string $key    The key.
	 * @return string
	 */
	private static function string_field( array $values, $key ) {
		return ( isset( $values[ $key ] ) && is_string( $values[ $key ] ) ) ? $values[ $key ] : '';
	}
}
