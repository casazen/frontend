<?php
/**
 * Tests of the language of Polylang and WPML: the widgets speak the language of the page, and the search bar leads to the booking
 * page of that language.
 *
 * Polylang and WPML are not installed in the tests. A language plugin is played by functions and constants, which a process can
 * not forget: every test that defines one runs in a separate process (`@runInSeparateProcess`), so that it does not leak into the
 * others. The doubles read what they answer from `$GLOBALS['casazen_pll']`, which each test sets.
 *
 * @package Casazen
 */

use Casazen\Compat\Polylang_Wpml;
use Casazen\Language;
use Casazen\Pages;
use Casazen\Settings;

/**
 * `Casazen\Compat\Polylang_Wpml`.
 */
class Test_Compat_Language extends WP_UnitTestCase {

	/**
	 * Starts every test as the front end of a site with an address.
	 */
	public function set_up() {
		parent::set_up();
		wp_set_current_user( 0 );
		$this->configure( array( 'address' => 'https://prenota.example.com' ) );
		wp_dequeue_script( 'casazen-embed' );
		wp_deregister_script( 'casazen-embed' );
	}

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
	 * Makes the locale of the request this one.
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
	 * Plays Polylang: defines its functions (this process keeps them) and sets what they answer.
	 *
	 * @param string|false $current      The slug of the current language, or false for none.
	 * @param array        $translations Page id => { language => id of the translation }.
	 * @param string       $default      The default language.
	 */
	private function play_polylang( $current, array $translations = array(), $default = 'it' ) {
		$GLOBALS['casazen_pll'] = array(
			'current'      => $current,
			'translations' => $translations,
			'default'      => $default,
			'languages'    => array(),
		);

		if ( ! function_exists( 'pll_current_language' ) ) {
			/**
			 * The double of Polylang: the current language the test chose.
			 *
			 * @param string $field What to return.
			 * @return string|false
			 */
			function pll_current_language( $field = 'slug' ) {
				return 'slug' === $field ? $GLOBALS['casazen_pll']['current'] : false;
			}

			/**
			 * The double of Polylang: the translations of a page, from the test.
			 *
			 * @param int    $post_id The page.
			 * @param string $lang    The language.
			 * @return int|false
			 */
			function pll_get_post( $post_id, $lang = '' ) {
				$all = isset( $GLOBALS['casazen_pll']['translations'][ $post_id ] ) ? $GLOBALS['casazen_pll']['translations'][ $post_id ] : array();
				return isset( $all[ $lang ] ) ? $all[ $lang ] : false;
			}

			/**
			 * The double of Polylang: the default language the test chose.
			 *
			 * @return string
			 */
			function pll_default_language() {
				return $GLOBALS['casazen_pll']['default'];
			}

			/**
			 * The double of Polylang: remembers the language a page was given.
			 *
			 * @param int    $post_id The page.
			 * @param string $lang    The language.
			 */
			function pll_set_post_language( $post_id, $lang ) {
				$GLOBALS['casazen_pll']['languages'][ $post_id ] = $lang;
			}
		}
	}

	/**
	 * Plays WPML: defines its version constant (this process keeps it) and makes its filter answer.
	 *
	 * @param string $current The code of the current language.
	 */
	private function play_wpml( $current ) {
		if ( ! defined( 'ICL_SITEPRESS_VERSION' ) ) {
			define( 'ICL_SITEPRESS_VERSION', '4.6.0' );
		}
		// A process that also played Polylang (a runner that does not isolate the tests) must not answer for it here.
		if ( isset( $GLOBALS['casazen_pll'] ) ) {
			$GLOBALS['casazen_pll']['current'] = false;
		}
		add_filter(
			'wpml_current_language',
			static function () use ( $current ) {
				return $current;
			}
		);
	}

	/**
	 * Creates a page that has a role.
	 *
	 * @param string $role   The role.
	 * @param string $title  The title.
	 * @param string $status The post status.
	 * @return int The id.
	 */
	private function create_role_page( $role, $title, $status = 'publish' ) {
		$page_id = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => $status,
				'post_title'  => $title,
			)
		);
		update_post_meta( $page_id, Pages::META_KEY, $role );
		return $page_id;
	}

	/**
	 * An attribute of the first element of a markup.
	 *
	 * @param string $html The markup of a widget.
	 * @param string $name The attribute.
	 * @return string|null
	 */
	private function attribute_of( $html, $name ) {
		$processor = new WP_HTML_Tag_Processor( $html );
		if ( ! $processor->next_tag( 'div' ) ) {
			return null;
		}
		$value = $processor->get_attribute( $name );
		return is_string( $value ) ? $value : null;
	}

	/**
	 * With neither plugin the compatibility answers nothing, and the locale decides.
	 */
	public function test_with_neither_plugin_the_locale_decides() {
		$this->assertNull( Polylang_Wpml::current_language() );
		$this->assertSame( 7, Polylang_Wpml::translate_page( 7 ), 'No language plugin: the page itself.' );
		$this->assertFalse( Polylang_Wpml::set_default_language( 7 ) );
		$this->assertTrue( false !== has_filter( 'casazen_current_language', array( Polylang_Wpml::class, 'filter_language' ) ) );
		$this->assertSame( 'kept', Polylang_Wpml::filter_language( 'kept' ), 'Without a plugin the filter hands on what it was given.' );

		$this->use_locale( 'it_IT' );
		$this->assertSame( 'it', $this->attribute_of( do_shortcode( '[casazen_booking]' ), 'data-casazen-lang' ) );
	}

	/**
	 * Polylang: the widgets of an English page carry `lang=en` (AC-NF148-3), whatever the locale of the site is.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_polylang_language_reaches_every_widget() {
		$this->play_polylang( 'en' );
		$this->use_locale( 'it_IT' );

		$this->assertSame( 'en', Polylang_Wpml::current_language() );
		$this->assertSame( 'en', Language::resolve( null ) );
		foreach ( array( '[casazen_booking]', '[casazen_property slug="villa-rossa"]', '[casazen_guest_access]', '[casazen_search]' ) as $shortcode ) {
			$this->assertSame( 'en', $this->attribute_of( do_shortcode( $shortcode ), 'data-casazen-lang' ), $shortcode );
		}
		$this->assertSame( 'it', $this->attribute_of( do_shortcode( '[casazen_booking lang="it"]' ), 'data-casazen-lang' ), 'The attribute wins.' );
	}

	/**
	 * A language that is neither Italian nor English maps to what the agency wrote in the language mapping (default `auto`).
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_polylang_language_goes_through_the_language_mapping() {
		$this->play_polylang( 'pt-br' );

		$this->assertSame( 'auto', $this->attribute_of( do_shortcode( '[casazen_booking]' ), 'data-casazen-lang' ), 'No entry: auto.' );

		$this->configure(
			array(
				'address'      => 'https://prenota.example.com',
				'language_map' => array( 'pt-br' => 'en' ),
			)
		);
		$this->assertSame( 'en', $this->attribute_of( do_shortcode( '[casazen_booking]' ), 'data-casazen-lang' ), 'The mapping of the agency.' );
	}

	/**
	 * Polylang without a current language (all languages, in the admin): the locale decides.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_polylang_without_a_current_language_leaves_it_to_the_locale() {
		$this->play_polylang( false );
		$this->use_locale( 'en_GB' );

		$this->assertNull( Polylang_Wpml::current_language() );
		$this->assertSame( 'en', Language::resolve( null ) );
	}

	/**
	 * Polylang: the booking page the search bar leads to is the one of the current language, when it has a translation.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_polylang_search_target_follows_the_language_of_the_page() {
		$italian = $this->create_role_page( Pages::ROLE_BOOKING, 'Prenota' );
		$english = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => 'Book',
			)
		);
		$this->play_polylang(
			'en',
			array(
				$italian => array(
					'it' => $italian,
					'en' => $english,
				),
			)
		);

		$this->assertSame( $english, Polylang_Wpml::translate_page( $italian ) );
		$this->assertSame( get_permalink( $english ), Pages::url_for_role( Pages::ROLE_BOOKING ) );
		$this->assertSame( get_permalink( $english ), $this->attribute_of( do_shortcode( '[casazen_search]' ), 'data-casazen-target' ) );

		// The visitor of the Italian page is sent to the Italian booking page.
		$GLOBALS['casazen_pll']['current'] = 'it';
		$this->assertSame( get_permalink( $italian ), Pages::url_for_role( Pages::ROLE_BOOKING ) );

		// No translation into the current language: the page itself.
		$GLOBALS['casazen_pll']['current']      = 'en';
		$GLOBALS['casazen_pll']['translations'] = array();
		$this->assertSame( $italian, Polylang_Wpml::translate_page( $italian ) );
		$this->assertSame( get_permalink( $italian ), Pages::url_for_role( Pages::ROLE_BOOKING ) );

		// A translation that is not published is not offered: the page itself.
		wp_update_post(
			array(
				'ID'          => $english,
				'post_status' => 'draft',
			)
		);
		$GLOBALS['casazen_pll']['translations'] = array( $italian => array( 'en' => $english ) );
		$this->assertSame( get_permalink( $italian ), Pages::url_for_role( Pages::ROLE_BOOKING ) );
	}

	/**
	 * Polylang: a page that the guided setup created gets the default language of Polylang, and no translation is made.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_polylang_default_language_goes_on_new_pages() {
		$this->play_polylang( 'en', array(), 'it' );

		$this->assertTrue( Polylang_Wpml::set_default_language( 41 ) );

		$this->assertSame( array( 41 => 'it' ), $GLOBALS['casazen_pll']['languages'] );
	}

	/**
	 * WPML: its filter gives the code of the current language.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_wpml_language_reaches_every_widget() {
		$this->play_wpml( 'en' );
		$this->use_locale( 'it_IT' );

		$this->assertSame( 'en', Polylang_Wpml::current_language() );
		foreach ( array( '[casazen_booking]', '[casazen_property slug="villa-rossa"]', '[casazen_guest_access]', '[casazen_search]' ) as $shortcode ) {
			$this->assertSame( 'en', $this->attribute_of( do_shortcode( $shortcode ), 'data-casazen-lang' ), $shortcode );
		}
	}

	/**
	 * WPML answers `all` in the admin, when no language is chosen: that is no language.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_wpml_all_languages_is_no_language() {
		$this->play_wpml( 'all' );
		$this->use_locale( 'it_IT' );

		$this->assertNull( Polylang_Wpml::current_language() );
		$this->assertSame( 'it', Language::resolve( null ) );
	}

	/**
	 * WPML: the booking page the search bar leads to is the one of the current language, through its filter `wpml_object_id`.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_wpml_search_target_follows_the_language_of_the_page() {
		$italian = $this->create_role_page( Pages::ROLE_BOOKING, 'Prenota' );
		$english = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => 'Book',
			)
		);
		$this->play_wpml( 'en' );
		$calls = array();
		add_filter(
			'wpml_object_id',
			static function ( $id, $type, $return_original, $language ) use ( $italian, $english, &$calls ) {
				$calls[] = array( $id, $type, $return_original, $language );
				return ( $id === $italian && 'en' === $language ) ? $english : $id;
			},
			10,
			4
		);

		$this->assertSame( get_permalink( $english ), Pages::url_for_role( Pages::ROLE_BOOKING ) );
		$this->assertSame(
			array( array( $italian, 'page', true, 'en' ) ),
			$calls,
			'The filter is asked for the page of the current language, with the original as the fallback.'
		);
	}
}
