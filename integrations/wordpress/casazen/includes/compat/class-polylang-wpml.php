<?php
/**
 * Polylang and WPML: the language of the page that is printed.
 *
 * @package Casazen
 */

namespace Casazen\Compat;

defined( 'ABSPATH' ) || exit;

/**
 * Tells the plugin which language the current page is in when Polylang or WPML is active, and finds the page of a role in that
 * language. Nothing here needs either plugin: with neither of them every answer is "none" and the plugin falls back to the
 * locale of the request.
 */
class Polylang_Wpml {

	/**
	 * Hooks the filter of the language on init, when the language plugins have started.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
	}

	/**
	 * Plugs the language plugins into `casazen_current_language` (see Language::resolve()).
	 *
	 * @return void
	 */
	public static function register() {
		add_filter( 'casazen_current_language', array( __CLASS__, 'filter_language' ) );
	}

	/**
	 * The answer of a language plugin, when there is one.
	 *
	 * @param string|null $code The code another callback gave, or null.
	 * @return string|null The code of the current language, or what was given when no language plugin answers.
	 */
	public static function filter_language( $code ) {
		$current = self::current_language();
		return null === $current ? $code : $current;
	}

	/**
	 * The code of the current language: `en`, `it`, `pt-br`...
	 *
	 * Polylang answers with the slug of its current language, WPML with the code of its current language. With neither plugin,
	 * or in a screen that has no language (all languages), the answer is null: the locale decides.
	 *
	 * @return string|null
	 */
	public static function current_language() {
		if ( function_exists( 'pll_current_language' ) ) {
			$slug = pll_current_language( 'slug' );
			return ( is_string( $slug ) && '' !== $slug ) ? $slug : null;
		}

		if ( defined( 'ICL_SITEPRESS_VERSION' ) ) {
			$code = apply_filters( 'wpml_current_language', null );
			return ( is_string( $code ) && '' !== $code && 'all' !== $code ) ? $code : null;
		}

		return null;
	}

	/**
	 * The translation of a page in the current language.
	 *
	 * @param int $page_id The id of a page.
	 * @return int The id of the translation of the page into the current language, or the page itself when there is none (or
	 *             when no language plugin is active).
	 */
	public static function translate_page( $page_id ) {
		$page_id  = (int) $page_id;
		$language = self::current_language();
		if ( null === $language ) {
			return $page_id;
		}

		if ( function_exists( 'pll_get_post' ) ) {
			$translated = pll_get_post( $page_id, $language );
		} elseif ( defined( 'ICL_SITEPRESS_VERSION' ) ) {
			$translated = apply_filters( 'wpml_object_id', $page_id, 'page', true, $language );
		} else {
			return $page_id;
		}
		return $translated ? (int) $translated : $page_id;
	}

	/**
	 * Gives a page that was just created the default language of Polylang, so that it shows in the language list instead of
	 * being left without one. No translation is made. WPML needs nothing: a new page takes its default language by itself.
	 *
	 * @param int $page_id The id of the new page.
	 * @return bool True when Polylang is active (the hint «translate the pages» then applies).
	 */
	public static function set_default_language( $page_id ) {
		if ( ! function_exists( 'pll_set_post_language' ) || ! function_exists( 'pll_default_language' ) ) {
			return false;
		}
		$language = pll_default_language();
		if ( is_string( $language ) && '' !== $language ) {
			pll_set_post_language( (int) $page_id, $language );
		}
		return true;
	}
}
