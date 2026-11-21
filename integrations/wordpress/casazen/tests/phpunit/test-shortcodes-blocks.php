<?php
/**
 * Tests of the shortcodes and the blocks: the same attributes, the same markup.
 *
 * The blocks are checked from their sources (`blocks/src/<name>/block.json`), so no build is needed.
 *
 * @package Casazen
 */

use Casazen\Blocks;
use Casazen\Renderer;
use Casazen\Settings;
use Casazen\Shortcodes;

/**
 * `Shortcodes` and `Blocks`.
 */
class Test_Shortcodes_Blocks extends WP_UnitTestCase {

	/**
	 * Starts every test with an address and a visitor.
	 */
	public function set_up() {
		parent::set_up();
		wp_set_current_user( 0 );
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://prenota.example.com' ) ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * The `block.json` of a block, from its sources.
	 *
	 * @param string $widget The widget (`booking`, `guest-access`...).
	 * @return array
	 */
	private function metadata( $widget ) {
		$path = CASAZEN_DIR . 'blocks/src/' . $widget . '/block.json';
		$this->assertFileExists( $path );
		$metadata = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file of the plugin.
		$this->assertIsArray( $metadata, $widget . ' has a valid block.json.' );
		return $metadata;
	}

	/**
	 * What the block prints, with the attributes the editor would save. It goes through the same preparation of the attributes
	 * (types and defaults of `block.json`) as a registered block.
	 *
	 * @param string $widget     The widget.
	 * @param array  $attributes The attributes of the block, typed as the editor saves them.
	 * @return string
	 */
	private function print_block( $widget, array $attributes ) {
		$metadata = $this->metadata( $widget );
		$type     = new WP_Block_Type(
			$metadata['name'],
			array(
				'attributes'      => $metadata['attributes'],
				'render_callback' => Blocks::render_callback( $widget ),
			)
		);
		return $type->render( $attributes );
	}

	/**
	 * The shortcode text for some attributes.
	 *
	 * @param string $tag        The shortcode tag.
	 * @param array  $attributes The attributes (strings).
	 * @return string
	 */
	private function shortcode( $tag, array $attributes ) {
		$text = '[' . $tag;
		foreach ( $attributes as $name => $value ) {
			$text .= ' ' . $name . '="' . $value . '"';
		}
		return $text . ']';
	}

	/**
	 * Each widget with attributes written the way a shortcode has them and typed the way a block saves them.
	 *
	 * @return array[] widget => { tag, shortcode attributes, block attributes }.
	 */
	private function cases() {
		return array(
			'booking'      => array(
				'casazen_booking',
				array(
					'lang'       => 'en',
					'checkin'    => '2027-05-10',
					'checkout'   => '2027-05-14',
					'guests'     => '2',
					'datalayer'  => 'false',
					'sync_url'   => 'true',
					'min_height' => '600',
					'primary'    => '#2b4c7e',
					'radius'     => '8px',
					'font'       => 'moderno',
				),
				array(
					'lang'       => 'en',
					'checkin'    => '2027-05-10',
					'checkout'   => '2027-05-14',
					'guests'     => 2,
					'datalayer'  => false,
					'sync_url'   => true,
					'min_height' => 600,
					'primary'    => '#2b4c7e',
					'radius'     => '8px',
					'font'       => 'moderno',
				),
			),
			'property'     => array(
				'casazen_property',
				array(
					'slug'    => 'villa-rossa',
					'lang'    => 'it',
					'guests'  => '4',
					'primary' => '#abc',
				),
				array(
					'slug'    => 'villa-rossa',
					'lang'    => 'it',
					'guests'  => 4,
					'primary' => '#abc',
				),
			),
			'search'       => array(
				'casazen_search',
				array(
					'target'       => '/prenota/',
					'lang'         => 'en',
					'destinations' => 'no',
					'max_guests'   => '8',
					'radius'       => '1rem',
				),
				array(
					'target'       => '/prenota/',
					'lang'         => 'en',
					'destinations' => 'no',
					'max_guests'   => 8,
					'radius'       => '1rem',
				),
			),
			'guest-access' => array(
				'casazen_guest_access',
				array(
					'lang'       => 'en',
					'datalayer'  => 'false',
					'min_height' => '420',
					'font'       => 'classico',
				),
				array(
					'lang'       => 'en',
					'datalayer'  => false,
					'min_height' => 420,
					'font'       => 'classico',
				),
			),
			'owner-login'  => array(
				'casazen_owner_login',
				array( 'label' => 'Owner sign-in' ),
				array( 'label' => 'Owner sign-in' ),
			),
		);
	}

	/**
	 * The five shortcodes exist.
	 */
	public function test_the_five_shortcodes_are_registered() {
		foreach ( array_keys( Shortcodes::TAGS ) as $tag ) {
			$this->assertTrue( shortcode_exists( $tag ), $tag );
		}
		$this->assertSame(
			array( 'booking', 'property', 'search', 'guest-access', 'owner-login' ),
			array_values( Shortcodes::TAGS )
		);
		$this->assertSame( array_keys( Renderer::attribute_map() ), Blocks::WIDGETS );
	}

	/**
	 * Data: a shortcode and a block with the same attributes print the same one-line markup, for every widget, and the block
	 * attributes are the shortcode attributes.
	 */
	public function test_markup_parity_for_every_widget() {
		foreach ( $this->cases() as $widget => $case ) {
			list( $tag, $shortcode_attributes, $block_attributes ) = $case;

			$from_shortcode = do_shortcode( $this->shortcode( $tag, $shortcode_attributes ) );
			$from_block     = $this->print_block( $widget, $block_attributes );

			$this->assertNotSame( '', $from_shortcode, $widget );
			$this->assertSame( $from_shortcode, $from_block, 'Parity of ' . $widget . ' with the attributes written out.' );
			$this->assertStringNotContainsString( "\n", $from_block, $widget );

			// Nothing written: the defaults of the shortcode are the defaults of the block.
			$this->assertSame(
				do_shortcode( '[' . $tag . ( 'property' === $widget ? ' slug="villa-rossa"' : '' ) . ']' ),
				$this->print_block( $widget, 'property' === $widget ? array( 'slug' => 'villa-rossa' ) : array() ),
				'Parity of ' . $widget . ' with the default attributes.'
			);

			if ( 'owner-login' !== $widget ) {
				$this->assertStringContainsString( 'data-casazen-widget="' . $widget . '"', $from_block );
				$this->assertStringContainsString( 'data-casazen-base="https://prenota.example.com"', $from_block );
			} else {
				$this->assertStringContainsString( 'href="https://prenota.example.com/portale-proprietari/accedi"', $from_block );
			}
		}
	}

	/**
	 * A value the renderer refuses is refused the same way through the shortcode and through the block.
	 */
	public function test_parity_also_for_invalid_values() {
		$shortcode = do_shortcode( '[casazen_booking guests="99" checkin="2027-02-31" primary="blue" lang="xx" datalayer="perhaps"]' );
		$block     = $this->print_block(
			'booking',
			array(
				'guests'    => 99,
				'checkin'   => '2027-02-31',
				'primary'   => 'blue',
				'lang'      => 'xx',
				'datalayer' => true,
			)
		);

		$this->assertSame( $shortcode, $block );
		$this->assertStringNotContainsString( 'data-casazen-guests', $block );
		$this->assertStringNotContainsString( 'data-casazen-checkin', $block );
		$this->assertStringNotContainsString( 'data-casazen-theme', $block );
	}

	/**
	 * The attributes of a block are the attributes of the widget in the renderer: same names, same types, same defaults.
	 */
	public function test_block_attributes_equal_the_shortcode_attributes() {
		foreach ( Renderer::attribute_map() as $widget => $attributes ) {
			$metadata = $this->metadata( $widget );

			$this->assertSame( 'casazen/' . $widget, $metadata['name'] );
			$this->assertSame( 3, $metadata['apiVersion'], $widget );
			$this->assertSame( 'widgets', $metadata['category'], $widget );
			$this->assertSame( 'casazen', $metadata['textdomain'], $widget );
			$this->assertSame( 'file:./index.js', $metadata['editorScript'], $widget );

			$declared = $metadata['attributes'];
			$names    = array_keys( $attributes );
			$block    = array_keys( $declared );
			sort( $names );
			sort( $block );
			$this->assertSame( $names, $block, 'The attributes of the block ' . $widget . ' are the ones of its shortcode.' );

			foreach ( $attributes as $name => $definition ) {
				$this->assertSame( $definition['type'], $declared[ $name ]['type'], $widget . '.' . $name . ' type' );
				$default = array_key_exists( 'default', $declared[ $name ] ) ? $declared[ $name ]['default'] : null;
				$this->assertSame( $definition['default'], $default, $widget . '.' . $name . ' default' );
			}
		}
	}

	/**
	 * The editor files exist for every block, and the source of the editor does not render the widget or call the network.
	 */
	public function test_the_sources_of_the_blocks() {
		foreach ( Blocks::WIDGETS as $widget ) {
			$this->assertFileExists( CASAZEN_DIR . 'blocks/src/' . $widget . '/index.js' );
		}
		$edit = (string) file_get_contents( CASAZEN_DIR . 'blocks/src/shared/placeholder-edit.js' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file of the plugin.
		$this->assertStringNotContainsString( '@wordpress/server-side-render', $edit, 'The editor does not ask the server for the widget.' );
		$this->assertStringNotContainsString( '<ServerSideRender', $edit );
		$this->assertStringNotContainsString( '@wordpress/api-fetch', $edit, 'The editor makes no request.' );
		$this->assertStringNotContainsString( 'fetch(', $edit );
	}

	/**
	 * Blocks are registered from the build; a block whose folder is missing is skipped without a word.
	 */
	public function test_blocks_register_from_the_build_and_skip_a_missing_folder() {
		$registry = WP_Block_Type_Registry::get_instance();
		foreach ( Blocks::WIDGETS as $widget ) {
			if ( $registry->is_registered( 'casazen/' . $widget ) ) {
				unregister_block_type( 'casazen/' . $widget );
			}
		}

		Blocks::register();

		foreach ( Blocks::WIDGETS as $widget ) {
			$built = is_readable( CASAZEN_DIR . 'blocks/build/' . $widget . '/block.json' );
			$this->assertSame( $built, $registry->is_registered( 'casazen/' . $widget ), 'casazen/' . $widget . ( $built ? ' is built and registered.' : ' has no build and is skipped.' ) );
			if ( ! $built ) {
				continue;
			}

			$this->assertTrue( $registry->get_registered( 'casazen/' . $widget )->is_dynamic(), $widget . ' is rendered by PHP.' );
			$attributes = 'property' === $widget ? array( 'slug' => 'villa-rossa' ) : array();
			$html       = render_block(
				array(
					'blockName'    => 'casazen/' . $widget,
					'attrs'        => $attributes,
					'innerHTML'    => '',
					'innerContent' => array(),
					'innerBlocks'  => array(),
				)
			);
			$this->assertSame( $this->print_block( $widget, $attributes ), $html, 'The registered block prints what the renderer prints.' );
			$this->assertNotSame( '', $html );
		}
	}
}
