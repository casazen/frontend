<?php
/**
 * Tests of the Elementor compatibility: the editor and the preview show a placeholder, the published page the widget.
 *
 * Elementor is not installed in the tests: a class double stands in for `\Elementor\Plugin`, the way the editor reports its mode.
 *
 * @package Casazen
 */

// phpcs:disable Universal.Namespaces.DisallowCurlyBraceSyntax, Universal.Namespaces.OneDeclarationPerFile, Universal.Namespaces.DisallowDeclarationWithoutName, Generic.Files.OneObjectStructurePerFile -- the file declares the double of an Elementor class in the namespace of Elementor, and the test class in the global namespace.

namespace Elementor {

	/**
	 * The double of the plugin class of Elementor: only the static instance that the compatibility reads.
	 */
	class Plugin {

		/**
		 * The instance of Elementor, null while the test does not play the editor.
		 *
		 * @var object|null
		 */
		public static $instance = null;
	}
}

namespace {

	use Casazen\Compat\Elementor as Elementor_Compat;
	use Casazen\Settings;

	/**
	 * `Casazen\Compat\Elementor` and the placeholder of the renderer.
	 */
	class Test_Compat_Elementor extends WP_UnitTestCase {

		/**
		 * Starts every test as the front end of a site with an address, and ends the play of the editor.
		 */
		public function set_up() {
			parent::set_up();
			wp_set_current_user( 0 );
			remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
			remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
			update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://prenota.example.com' ) ) );
			add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
			add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
			wp_dequeue_script( 'casazen-embed' );
			wp_deregister_script( 'casazen-embed' );
			\Elementor\Plugin::$instance = null;
		}

		/**
		 * Puts the double in the mode the test wants.
		 *
		 * @param bool $editing   What `editor->is_edit_mode()` answers.
		 * @param bool $previewing What `preview->is_preview_mode()` answers.
		 */
		private function play_elementor( $editing, $previewing ) {
			\Elementor\Plugin::$instance = (object) array(
				'editor'  => new class( $editing ) {
					/**
					 * The mode.
					 *
					 * @var bool
					 */
					private $on;

					/**
					 * Sets the mode.
					 *
					 * @param bool $on Whether the editor is open.
					 */
					public function __construct( $on ) {
						$this->on = $on;
					}

					/**
					 * The question the compatibility asks.
					 *
					 * @return bool
					 */
					public function is_edit_mode() {
						return $this->on;
					}
				},
				'preview' => new class( $previewing ) {
					/**
					 * The mode.
					 *
					 * @var bool
					 */
					private $on;

					/**
					 * Sets the mode.
					 *
					 * @param bool $on Whether the preview is shown.
					 */
					public function __construct( $on ) {
						$this->on = $on;
					}

					/**
					 * The question the compatibility asks.
					 *
					 * @return bool
					 */
					public function is_preview_mode() {
						return $this->on;
					}
				},
			);
		}

		/**
		 * The filter is hooked by the plugin.
		 */
		public function test_the_filter_is_hooked() {
			$this->assertNotFalse( has_filter( 'casazen_render_placeholder', array( Elementor_Compat::class, 'filter_placeholder' ) ) );
		}

		/**
		 * In the editor and in the preview the widgets are a static placeholder and the loader is not enqueued.
		 */
		public function test_editor_and_preview_get_the_placeholder_and_no_loader() {
			foreach ( array(
				'the editor'  => array( true, false ),
				'the preview' => array( false, true ),
				'both'        => array( true, true ),
			) as $label => $mode ) {
				$this->play_elementor( $mode[0], $mode[1] );

				foreach ( array( '[casazen_booking]', '[casazen_property slug="villa-rossa"]', '[casazen_search]', '[casazen_guest_access]' ) as $shortcode ) {
					$html = do_shortcode( $shortcode );
					$this->assertStringContainsString( '<div class="casazen-placeholder">CasaZen — the booking engine appears on the published page</div>', $html, $shortcode . ' in ' . $label );
					$this->assertStringNotContainsString( 'data-casazen-widget', $html );
				}
				$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ), 'No loader in ' . $label . '.' );
			}
		}

		/**
		 * On the published page (Elementor active, but neither editor nor preview) the Shortcode widget outputs the real element.
		 */
		public function test_the_published_page_gets_the_real_element() {
			$this->play_elementor( false, false );

			$html = do_shortcode( '[casazen_booking]' );

			$this->assertStringContainsString( 'data-casazen-widget="booking"', $html );
			$this->assertStringNotContainsString( 'casazen-placeholder', $html );
			$this->assertTrue( wp_script_is( 'casazen-embed', 'enqueued' ) );
		}

		/**
		 * Without Elementor (no instance, or an instance that is not an object) nothing changes.
		 */
		public function test_without_elementor_nothing_changes() {
			\Elementor\Plugin::$instance = null;
			$this->assertFalse( Elementor_Compat::is_editing() );
			$this->assertStringContainsString( 'data-casazen-widget="booking"', do_shortcode( '[casazen_booking]' ) );

			\Elementor\Plugin::$instance = (object) array();
			$this->assertFalse( Elementor_Compat::is_editing(), 'An instance without editor and preview.' );

			\Elementor\Plugin::$instance = 'not an object';
			$this->assertFalse( Elementor_Compat::is_editing() );
		}

		/**
		 * The filter keeps what an earlier callback decided.
		 */
		public function test_the_filter_keeps_an_earlier_yes() {
			$this->play_elementor( false, false );

			$this->assertTrue( Elementor_Compat::filter_placeholder( true ) );
			$this->assertFalse( Elementor_Compat::filter_placeholder( false ) );
			$this->assertFalse( Elementor_Compat::filter_placeholder( null ) );
		}
	}
}
