<?php
/**
 * The places the search bar offers (its «Where» field), kept in a transient.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Keeps the destinations of the agency for the search bar.
 *
 * The list comes from `GET <apiBase>/api/public/orgs/<slug>/destinations` and is read ONLY from the settings screen (through
 * the refresh of the connection) and from a background event: a page that a visitor opens reads the transient and never calls
 * CasaZen. A miss schedules one event and the bar is printed without places until it has run.
 */
class Destinations {

	/**
	 * The list is kept in a transient named with this prefix and 12 characters of a hash.
	 *
	 * @var string
	 */
	const CACHE_PREFIX = 'casazen_destinations_';

	/**
	 * The cron event that refreshes the list in the background.
	 *
	 * @var string
	 */
	const CRON_EVENT = 'casazen_refresh_destinations';

	/**
	 * How long a list that was read is kept (12 hours).
	 *
	 * @var int
	 */
	const SUCCESS_TTL = 12 * HOUR_IN_SECONDS;

	/**
	 * How long a failure is kept (15 minutes), as an empty list: an unreachable CasaZen is not retried on every request.
	 *
	 * @var int
	 */
	const FAILURE_TTL = 15 * MINUTE_IN_SECONDS;

	/**
	 * Seconds between the cache miss of a public page and the background refresh it schedules.
	 *
	 * @var int
	 */
	const SCHEDULE_DELAY = 10;

	/**
	 * Most places kept: the search bar takes no more.
	 *
	 * @var int
	 */
	const MAX_ITEMS = 200;

	/**
	 * Longest label kept, in characters: the search bar drops a longer one.
	 *
	 * @var int
	 */
	const MAX_LABEL_LENGTH = 80;

	/**
	 * Most characters the JSON of the list may have: the search bar ignores a longer attribute.
	 *
	 * @var int
	 */
	const MAX_JSON_LENGTH = 60000;

	/**
	 * The id of a place: the characters the search bar accepts, nothing is rewritten.
	 *
	 * @var string
	 */
	const ID_PATTERN = '/^[A-Za-z0-9._~-]{1,100}$/D';

	/**
	 * Hooks the background refresh and the refresh that follows every connection test.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( self::CRON_EVENT, array( __CLASS__, 'refresh' ) );
		add_action( 'casazen_connection_refreshed', array( __CLASS__, 'on_connection_refreshed' ) );
	}

	/**
	 * The places for the search bar, as the cache holds them. It never calls CasaZen: a miss schedules ONE background event and
	 * answers with an empty list.
	 *
	 * @return array[] A list of { id, label }, at most 200; empty while nothing is cached or when the agency has no place.
	 */
	public static function for_search() {
		$settings = Settings::get();
		if ( '' === $settings['address'] ) {
			return array();
		}

		$value = get_transient( self::cache_key( $settings['address'], $settings['org_slug'] ) );
		if ( is_array( $value ) ) {
			// The value was cleaned when it was stored; it is cleaned again, so what an object cache returns is never trusted.
			return self::clean_list( $value );
		}

		self::schedule_refresh();
		return array();
	}

	/**
	 * Reads the destinations from CasaZen and keeps them. Called by the background event and by the refresh of the connection;
	 * never by a request of a visitor.
	 *
	 * A failure (no usable connection, no answer, a refusal) keeps an empty list for 15 minutes: the bar is then printed without
	 * places and CasaZen is not asked again at every page.
	 *
	 * @return array[] The list that was kept: { id, label } items, possibly none.
	 */
	public static function refresh() {
		$settings = Settings::get();
		if ( '' === $settings['address'] ) {
			return array();
		}
		$key = self::cache_key( $settings['address'], $settings['org_slug'] );

		$list       = null;
		$connection = Connection::cached();
		if ( is_array( $connection ) && ! empty( $connection['ok'] ) && ! empty( $connection['apiBase'] ) ) {
			// The slug CasaZen gave for the address, else the one of the settings (the CasaZen domain).
			$slug = ! empty( $connection['slug'] ) ? (string) $connection['slug'] : $settings['org_slug'];
			if ( '' !== $slug ) {
				$list = self::fetch( (string) $connection['apiBase'], $slug );
			}
		}

		if ( null === $list ) {
			set_transient( $key, array(), self::FAILURE_TTL );
			return array();
		}
		set_transient( $key, $list, self::SUCCESS_TTL );
		return $list;
	}

	/**
	 * After a test of the connection: when it worked, the destinations are read again.
	 *
	 * @param mixed $result The normalised result of the test (the argument of `casazen_connection_refreshed`).
	 * @return void
	 */
	public static function on_connection_refreshed( $result ) {
		if ( is_array( $result ) && ! empty( $result['ok'] ) ) {
			self::refresh();
		}
	}

	/**
	 * The name of the transient that holds the list for an address and a slug.
	 *
	 * @param string $address The origin of the agency address.
	 * @param string $slug    The organisation slug of the settings (may be empty).
	 * @return string
	 */
	public static function cache_key( $address, $slug ) {
		return self::CACHE_PREFIX . substr( md5( $address . '|' . $slug ), 0, 12 );
	}

	/**
	 * Reduces a list to what the search bar reads: { id, label } items.
	 *
	 * An item whose id is not made of the characters of a slug is dropped, never rewritten; so is an item with no label, a
	 * repeated id and whatever comes after the 200th. The label loses its tags and extra spaces and is cut to 80 characters.
	 *
	 * @param mixed $raw The decoded answer of CasaZen, or a list that was kept.
	 * @return array[]
	 */
	public static function clean_list( $raw ) {
		$list = array();
		if ( ! is_array( $raw ) ) {
			return $list;
		}

		$seen = array();
		foreach ( $raw as $item ) {
			if ( count( $list ) >= self::MAX_ITEMS ) {
				break;
			}
			if ( ! is_array( $item ) || ! isset( $item['id'], $item['label'] ) || ! is_string( $item['id'] ) || ! is_string( $item['label'] ) ) {
				continue;
			}
			if ( 1 !== preg_match( self::ID_PATTERN, $item['id'] ) || isset( $seen[ $item['id'] ] ) ) {
				continue;
			}
			$label = trim( (string) preg_replace( '/\s+/u', ' ', wp_strip_all_tags( $item['label'] ) ) );
			$label = trim( mb_substr( $label, 0, self::MAX_LABEL_LENGTH ) );
			if ( '' === $label ) {
				continue;
			}
			$seen[ $item['id'] ] = true;
			$list[]              = array(
				'id'    => $item['id'],
				'label' => $label,
			);
		}
		return $list;
	}

	/**
	 * The list as the JSON of the attribute `data-casazen-destinations`, or an empty string when there is nothing to say.
	 *
	 * Letters with accents are written as they are (not as `à`), so that 200 places stay far below the 60 000 characters the
	 * search bar accepts; should the text still be longer, the last places are left out until it fits.
	 *
	 * @param array[] $places The list returned by for_search().
	 * @return string
	 */
	public static function to_json( array $places ) {
		$places = self::clean_list( $places );
		while ( array() !== $places ) {
			$json = wp_json_encode( $places, JSON_UNESCAPED_UNICODE );
			if ( is_string( $json ) && strlen( $json ) <= self::MAX_JSON_LENGTH ) {
				return $json;
			}
			array_pop( $places );
		}
		return '';
	}

	/**
	 * Schedules one single event that will run refresh(), unless one is already waiting.
	 *
	 * @return void
	 */
	private static function schedule_refresh() {
		if ( ! wp_next_scheduled( self::CRON_EVENT ) ) {
			wp_schedule_single_event( time() + self::SCHEDULE_DELAY, self::CRON_EVENT );
		}
	}

	/**
	 * Asks CasaZen for the destinations of an organisation, with the limits of the connection test.
	 *
	 * @param string $api_base The API address of the connection result.
	 * @param string $slug     The organisation slug.
	 * @return array[]|null The list, possibly empty; null when CasaZen did not answer with a list.
	 */
	private static function fetch( $api_base, $slug ) {
		$url   = Connection::api_url( $api_base, '/public/orgs/' . rawurlencode( $slug ) . '/destinations' );
		$reply = Connection::get_json( $url, Connection::allows_development_hosts() );
		if ( null === $reply || 200 !== $reply['status'] || ! is_array( $reply['data'] ) ) {
			return null;
		}
		return self::clean_list( $reply['data'] );
	}
}
