<?php
/**
 * Tests of the language of a widget: the order explicit attribute, filter, language mapping, locale.
 *
 * @package Casazen
 */

use Casazen\Language;
use Casazen\Settings;

/**
 * `Language::resolve()`.
 */
class Test_Language extends WP_UnitTestCase {

	/**
	 * Stores the settings without the hooks that run a refresh of the connection.
	 *
	 * @param array $values The values to change.
	 */
	private function configure( array $values ) {
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), $values ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * Makes the request speak this locale.
	 *
	 * @param string $locale For example `de_DE`.
	 */
	private function use_locale( $locale ) {
		add_filter(
			'determine_locale',
			static function () use ( $locale ) {
				return $locale;
			}
		);
	}

	/**
	 * Makes a language plugin answer with this code.
	 *
	 * @param mixed $code What the filter returns.
	 */
	private function use_language_plugin( $code ) {
		add_filter(
			'casazen_current_language',
			static function () use ( $code ) {
				return $code;
			}
		);
	}

	/**
	 * A valid attribute is the answer, whatever a language plugin or the locale says.
	 */
	public function test_a_valid_attribute_wins() {
		$this->use_language_plugin( 'it' );
		$this->use_locale( 'de_DE' );

		$this->assertSame( 'en', Language::resolve( 'en' ) );
		$this->assertSame( 'it', Language::resolve( 'IT' ) );
		$this->assertSame( 'auto', Language::resolve( ' auto ' ) );
	}

	/**
	 * An attribute that is not valid, or empty, leaves the choice to the filter.
	 */
	public function test_an_invalid_attribute_falls_through_to_the_filter() {
		$this->use_language_plugin( 'en' );
		$this->use_locale( 'it_IT' );

		$this->assertSame( 'en', Language::resolve( 'de' ) );
		$this->assertSame( 'en', Language::resolve( '' ) );
		$this->assertSame( 'en', Language::resolve( null ) );
	}

	/**
	 * With no language plugin, or an answer that is no code, the locale of the request decides.
	 */
	public function test_without_an_answer_of_a_language_plugin_the_locale_decides() {
		$this->use_locale( 'it_IT' );
		$this->assertSame( 'it', Language::resolve( null ) );

		$this->use_language_plugin( array( 'en' ) );
		$this->assertSame( 'it', Language::resolve( null ), 'An answer that is not a string is no answer.' );

		remove_all_filters( 'casazen_current_language' );
		$this->use_language_plugin( '   ' );
		$this->assertSame( 'it', Language::resolve( null ), 'A blank answer is no answer.' );
	}

	/**
	 * With no entry in the mapping Italian is `it`, English is `en` and any other language is left to the loader.
	 */
	public function test_the_defaults_without_a_mapping() {
		$expected = array(
			'it'    => 'it',
			'it_IT' => 'it',
			'it_CH' => 'it',
			'en'    => 'en',
			'en_US' => 'en',
			'EN-gb' => 'en',
			'de_DE' => 'auto',
			'fr'    => 'auto',
			'pt-br' => 'auto',
		);
		foreach ( $expected as $code => $widget_language ) {
			$this->use_language_plugin( $code );
			$this->assertSame( $widget_language, Language::resolve( null ), 'The code ' . $code . '.' );
			remove_all_filters( 'casazen_current_language' );
		}
	}

	/**
	 * The mapping of the settings is looked up as it is, then by the language part of the code, in any case and with `_` or `-`.
	 */
	public function test_the_language_mapping() {
		$this->configure(
			array(
				'address'      => 'https://prenota.example.com',
				'language_map' => array(
					'de'    => 'en',
					'pt-br' => 'it',
					'it_IT' => 'auto',
					'as'    => 'en',
				),
			)
		);

		$expected = array(
			'de_DE' => 'en',
			'de'    => 'en',
			'DE_at' => 'en',
			'pt-br' => 'it',
			'pt_BR' => 'it',
			'PT-BR' => 'it',
			'it_IT' => 'auto',
			'it_CH' => 'it',
			'fr_FR' => 'auto',
			// A code of three letters is not cut to two: `ast` is not `as`.
			'ast'   => 'auto',
			'as_IN' => 'en',
		);
		foreach ( $expected as $code => $widget_language ) {
			$this->use_language_plugin( $code );
			$this->assertSame( $widget_language, Language::resolve( null ), 'The code ' . $code . '.' );
			remove_all_filters( 'casazen_current_language' );
		}
	}

	/**
	 * `map()` ignores a mapping line that is not usable.
	 */
	public function test_map_ignores_unusable_lines() {
		$this->assertSame( 'auto', Language::map( '', array( 'de' => 'en' ) ) );
		$this->assertSame( 'auto', Language::map( 'de', array( 'de' => 'klingon' ) ), 'A value that is not it, en or auto is ignored.' );
		$this->assertSame( 'it', Language::map( 'it', 'not an array' ) );
		$this->assertSame( 'auto', Language::map( array( 'de' ), array() ), 'A code that is not text is no code.' );
	}
}
