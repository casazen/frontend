<?php
/**
 * Elementor: the editor and the preview show a static placeholder, not the widget.
 *
 * @package Casazen
 */

namespace Casazen\Compat;

defined( 'ABSPATH' ) || exit;

/**
 * The plugin works in Elementor through its «Shortcode» widget: the shortcode prints one line with no newline, so nothing wraps
 * it. In the editor and in the preview an iframe is not wanted (and the loader is not loaded): the renderer is asked for its
 * placeholder instead. Nothing else: no Elementor widget, no dependency on Elementor.
 */
class Elementor {

	/**
	 * Hooks the placeholder filter.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter( 'casazen_render_placeholder', array( __CLASS__, 'filter_placeholder' ) );
	}

	/**
	 * Turns the placeholder on while Elementor is drawing its editor or its preview.
	 *
	 * @param mixed $placeholder What an earlier callback decided.
	 * @return bool
	 */
	public static function filter_placeholder( $placeholder ) {
		return ( true === $placeholder ) || self::is_editing();
	}

	/**
	 * Whether Elementor is in its editor or in its preview. False when Elementor is not active.
	 *
	 * @return bool
	 */
	public static function is_editing() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}

		$plugin = \Elementor\Plugin::$instance;
		if ( ! is_object( $plugin ) ) {
			return false;
		}

		if ( isset( $plugin->editor ) && is_object( $plugin->editor ) && method_exists( $plugin->editor, 'is_edit_mode' ) && $plugin->editor->is_edit_mode() ) {
			return true;
		}
		return isset( $plugin->preview ) && is_object( $plugin->preview ) && method_exists( $plugin->preview, 'is_preview_mode' ) && $plugin->preview->is_preview_mode();
	}
}
