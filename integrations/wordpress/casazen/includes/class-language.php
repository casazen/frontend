<?php
/**
 * The language a widget is asked to speak.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Works out the language of a widget: `it`, `en` or `auto` (`auto` lets the loader read the language of the page).
 */
class Language {

	/**
	 * Resolves the language of a widget.
	 *
	 * The order is: the attribute of the widget when it is valid (`it`, `en` or `auto`); else the answer of the filter
	 * `casazen_current_language` (a language plugin answers there); else the locale of the request. The code found is looked up
	 * in the language mapping of the settings, first as it is and then by its language part (`pt-br` gives `pt`); a code with no
	 * entry gives `it` for Italian, `en` for English and `auto` for any other language.
	 *
	 * @param string|null $explicit The `lang` attribute as the author wrote it, or null when there is none.
	 * @return string `it`, `en` or `auto`.
	 */
	public static function resolve( $explicit = null ) {
		if ( is_string( $explicit ) ) {
			$wanted = strtolower( trim( $explicit ) );
			if ( in_array( $wanted, Settings::LANGUAGES, true ) ) {
				return $wanted;
			}
		}

		/**
		 * Filters the language code of the page that is being printed.
		 *
		 * A language plugin (Polylang, WPML) answers with the code of the current language of the page, for example `en` or
		 * `pt-br`. Anything that is not a non-empty string means "no answer": the locale of the request is used.
		 *
		 * @param string|null $code The language code, or null when nobody answered.
		 */
		$code = apply_filters( 'casazen_current_language', null );
		if ( ! is_string( $code ) || '' === trim( $code ) ) {
			$code = determine_locale();
		}

		$settings = Settings::get();
		return self::map( $code, $settings['language_map'] );
	}

	/**
	 * Maps a language code to `it`, `en` or `auto` with the language mapping of the settings.
	 *
	 * @param string $code         The code: a locale (`it_IT`) or a language code (`en`, `pt-br`), in any case.
	 * @param mixed  $language_map The mapping of the settings: code => `it`, `en` or `auto`.
	 * @return string `it`, `en` or `auto`.
	 */
	public static function map( $code, $language_map ) {
		$code = self::normalise( $code );
		if ( '' === $code ) {
			return 'auto';
		}

		$map = array();
		if ( is_array( $language_map ) ) {
			foreach ( $language_map as $key => $value ) {
				$key = self::normalise( (string) $key );
				if ( '' !== $key && is_string( $value ) && in_array( $value, Settings::LANGUAGES, true ) ) {
					$map[ $key ] = $value;
				}
			}
		}

		if ( isset( $map[ $code ] ) ) {
			return $map[ $code ];
		}
		$base = self::base( $code );
		if ( isset( $map[ $base ] ) ) {
			return $map[ $base ];
		}
		if ( 'it' === $base || 'en' === $base ) {
			return $base;
		}
		return 'auto';
	}

	/**
	 * A code in one form: lower case, with a hyphen where a locale has an underscore (`pt_BR` and `pt-br` are the same code).
	 *
	 * @param mixed $code The code.
	 * @return string
	 */
	private static function normalise( $code ) {
		if ( ! is_string( $code ) ) {
			return '';
		}
		return strtolower( str_replace( '_', '-', trim( $code ) ) );
	}

	/**
	 * The language part of a normalised code: the text before the first hyphen (`pt-br` gives `pt`, `ast` stays `ast`).
	 *
	 * @param string $code A normalised code.
	 * @return string
	 */
	private static function base( $code ) {
		$parts = explode( '-', $code, 2 );
		return $parts[0];
	}
}
