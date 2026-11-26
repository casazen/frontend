<?php
/**
 * The loader script of the widgets: when it is put in the page, and how.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Puts `<address>/embed/v1/embed.js` in the page, once per request, when a widget that needs it was printed.
 *
 * The script is the same file the agency could paste by hand: it mounts every element the renderer prints. The search bar is
 * not enqueued here: the loader fetches `search.js` by itself, only when a page has a search bar.
 */
class Assets {

	/**
	 * The handle of the loader script.
	 *
	 * @var string
	 */
	const HANDLE = 'casazen-embed';

	/**
	 * Attributes that cache and optimisation plugins read to leave a script alone (combine, minify, delay, defer by their own
	 * means): LiteSpeed, Autoptimize, WP Rocket, Cloudflare Rocket Loader, PageSpeed, WP Fastest Cache. A plugin that ignores
	 * them needs the path `/embed/v1/` in its exclusion list (see the guide of the plugin). `true` is an attribute without value.
	 *
	 * @var array
	 */
	const OPTIMISER_ATTRIBUTES = array(
		'data-no-optimize'        => '1',
		'data-no-defer'           => '1',
		'data-no-minify'          => '1',
		'data-cfasync'            => 'false',
		'data-pagespeed-no-defer' => true,
		'data-wpfc-render'        => 'false',
	);

	/**
	 * Whether the tag was already printed by hand after the footer scripts (see require_loader()).
	 *
	 * @var bool
	 */
	private static $printed_late = false;

	/**
	 * Hooks the tag filter.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter( 'script_loader_tag', array( __CLASS__, 'filter_tag' ), 10, 2 );
	}

	/**
	 * The address of the loader of an agency: always computed from the saved address, never taken from the network.
	 *
	 * @param string $address The origin of the agency address.
	 * @return string
	 */
	public static function loader_url( $address ) {
		return $address . '/embed/v1/embed.js';
	}

	/**
	 * Asks for the loader: called by the renderer each time it prints a widget that the loader mounts.
	 *
	 * Nothing happens when the script is switched off in the settings or there is no address. Otherwise the script is enqueued
	 * (the second call for the same handle changes nothing) with `defer`, in the footer. A widget printed after the footer
	 * scripts (a widget in a footer widget area, for example) is too late for the queue: the tag is printed once, there and then.
	 *
	 * @return void
	 */
	public static function require_loader() {
		$settings = Settings::get();
		if ( ! $settings['load_script'] || '' === $settings['address'] ) {
			return;
		}
		$url = self::loader_url( $settings['address'] );

		if ( did_action( 'wp_print_footer_scripts' ) ) {
			if ( ! self::$printed_late && ! wp_script_is( self::HANDLE, 'done' ) ) {
				self::$printed_late = true;
				wp_print_script_tag(
					array_merge(
						array(
							'id'    => self::HANDLE . '-js',
							'src'   => $url,
							'defer' => true,
						),
						self::OPTIMISER_ATTRIBUTES
					)
				);
			}
			return;
		}

		wp_enqueue_script(
			self::HANDLE,
			$url,
			array(),
			null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- the file belongs to CasaZen and says its own version in its path (/embed/v1/).
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);
	}

	/**
	 * Adds the attributes that cache and optimisation plugins respect to the tag of the loader. `defer` stays as WordPress wrote it.
	 *
	 * @param mixed  $tag    The `<script>` tag.
	 * @param string $handle The handle of the script.
	 * @return mixed The tag.
	 */
	public static function filter_tag( $tag, $handle = '' ) {
		if ( self::HANDLE !== $handle || ! is_string( $tag ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $tag;
		}

		$processor = new \WP_HTML_Tag_Processor( $tag );
		while ( $processor->next_tag( 'script' ) ) {
			// The tag of the script itself, not an inline script that WordPress printed before or after it.
			if ( null === $processor->get_attribute( 'src' ) ) {
				continue;
			}
			foreach ( self::OPTIMISER_ATTRIBUTES as $name => $value ) {
				$processor->set_attribute( $name, $value );
			}
			return $processor->get_updated_html();
		}
		return $tag;
	}
}
