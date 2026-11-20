<?php
/**
 * The settings screen: Settings, then CasaZen.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Admin side of the plugin: the settings page, its status box and the «Test connection» button.
 *
 * Every action checks the capability and a nonce, every output is escaped where it is printed, and there is no field for a
 * secret (phase 1 has no API key).
 */
class Admin {

	/**
	 * The capability needed to see the screen and to use its two forms.
	 *
	 * @var string
	 */
	const CAPABILITY = 'manage_options';

	/**
	 * Slug of the settings page (Settings, then CasaZen).
	 *
	 * @var string
	 */
	const PAGE_SLUG = 'casazen';

	/**
	 * Action and nonce of the «Test connection» form (`admin-post.php?action=casazen_test_connection`).
	 *
	 * @var string
	 */
	const TEST_ACTION = 'casazen_test_connection';

	/**
	 * Name of the nonce field of the «Test connection» form (the settings form has its own, from the Settings API).
	 *
	 * @var string
	 */
	const NONCE_FIELD = 'casazen_nonce';

	/**
	 * The hook suffix of the settings page (its screen id), known once the menu is built.
	 *
	 * @var string
	 */
	private static $page_hook = '';

	/**
	 * Hooks the admin side into WordPress (only called in the admin).
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_fields' ) );
		add_action( 'admin_notices', array( __CLASS__, 'maybe_show_setup_notice' ) );
		add_action( 'admin_post_' . self::TEST_ACTION, array( __CLASS__, 'handle_test_connection' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( CASAZEN_FILE ), array( __CLASS__, 'plugin_action_links' ) );
	}

	/**
	 * Adds Settings, then CasaZen, for users who can manage options.
	 *
	 * @return string|false The hook suffix of the page, or false when the user may not see it.
	 */
	public static function add_menu() {
		$hook_suffix = add_options_page(
			'CasaZen',
			'CasaZen',
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);

		// The screen id of the page: the notice below is printed only there.
		self::$page_hook = is_string( $hook_suffix ) ? $hook_suffix : '';
		return $hook_suffix;
	}

	/**
	 * Adds the sections and the fields of the settings form (the labels are built here, after init).
	 *
	 * @return void
	 */
	public static function register_fields() {
		add_settings_section(
			'casazen_connection',
			__( 'Connection', 'casazen' ),
			array( __CLASS__, 'render_connection_intro' ),
			self::PAGE_SLUG
		);
		add_settings_field(
			'casazen_address',
			__( 'CasaZen address', 'casazen' ),
			array( __CLASS__, 'render_address_field' ),
			self::PAGE_SLUG,
			'casazen_connection',
			array( 'label_for' => 'casazen-address' )
		);
		add_settings_field(
			'casazen_org_slug',
			__( 'Organisation slug', 'casazen' ),
			array( __CLASS__, 'render_org_slug_field' ),
			self::PAGE_SLUG,
			'casazen_connection',
			array( 'label_for' => 'casazen-org-slug' )
		);

		add_settings_section(
			'casazen_display',
			__( 'Display', 'casazen' ),
			'__return_false',
			self::PAGE_SLUG
		);
		add_settings_field(
			'casazen_language_map',
			__( 'Language mapping', 'casazen' ),
			array( __CLASS__, 'render_language_map_field' ),
			self::PAGE_SLUG,
			'casazen_display',
			array( 'label_for' => 'casazen-language-map' )
		);
		add_settings_field(
			'casazen_load_script',
			__( 'Script', 'casazen' ),
			array( __CLASS__, 'render_load_script_field' ),
			self::PAGE_SLUG,
			'casazen_display'
		);
	}

	/**
	 * Adds the «Settings» link to the row of the plugin in the plugins list.
	 *
	 * @param mixed $links The links WordPress prints.
	 * @return array
	 */
	public static function plugin_action_links( $links ) {
		$links = is_array( $links ) ? $links : array();
		$url   = admin_url( 'options-general.php?page=' . self::PAGE_SLUG );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'casazen' ) . '</a>' );
		return $links;
	}

	/**
	 * The notice «Set the CasaZen address»: only on the plugin screen and only for users who can manage options.
	 *
	 * @return void
	 */
	public static function maybe_show_setup_notice() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( '' === self::$page_hook || ! $screen || self::$page_hook !== $screen->id ) {
			return;
		}
		$settings = Settings::get();
		if ( '' !== $settings['address'] ) {
			return;
		}
		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'Set the CasaZen address to start using the plugin.', 'casazen' )
		);
	}

	/**
	 * The «Test connection» form: checks the capability and the nonce, runs the test, comes back with the result code only.
	 *
	 * @return void
	 */
	public static function handle_test_connection() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die(
				esc_html__( 'You do not have permission to do this.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}
		check_admin_referer( self::TEST_ACTION, self::NONCE_FIELD );

		$result = Connection::refresh();

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'           => self::PAGE_SLUG,
					'casazen_result' => $result['code'],
				),
				admin_url( 'options-general.php' )
			)
		);
		exit;
	}

	/**
	 * Prints the settings page.
	 *
	 * @return void
	 */
	public static function render_page() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die(
				esc_html__( 'You do not have permission to open this page.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}
		?>
		<div class="wrap">
			<h1>CasaZen</h1>
			<hr class="wp-header-end" />
			<?php self::render_test_result(); ?>
			<?php self::render_status(); ?>

			<form method="post" action="options.php">
				<?php
				settings_fields( Settings::GROUP );
				do_settings_sections( self::PAGE_SLUG );
				submit_button();
				?>
			</form>

			<h2><?php esc_html_e( 'Test connection', 'casazen' ); ?></h2>
			<p><?php esc_html_e( 'Check now that this site can reach your CasaZen address.', 'casazen' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php?action=' . self::TEST_ACTION ) ); ?>">
				<?php
				wp_nonce_field( self::TEST_ACTION, self::NONCE_FIELD );
				submit_button( __( 'Test connection', 'casazen' ), 'secondary', 'casazen_test_submit', false );
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Introduction of the connection section.
	 *
	 * @return void
	 */
	public static function render_connection_intro() {
		echo '<p>' . esc_html__( 'The address where your CasaZen booking site lives. The widgets are loaded by the browser of your visitors straight from this address.', 'casazen' ) . '</p>';
	}

	/**
	 * The field of the address.
	 *
	 * @return void
	 */
	public static function render_address_field() {
		$settings = Settings::get();
		printf(
			'<input type="url" id="casazen-address" name="%1$s[address]" value="%2$s" class="regular-text code" placeholder="https://prenota.example.com" autocomplete="off" spellcheck="false" aria-describedby="casazen-address-help" />',
			esc_attr( Settings::OPTION ),
			esc_attr( $settings['address'] )
		);
		printf(
			'<p class="description" id="casazen-address-help">%s</p>',
			esc_html__( 'The address of your CasaZen booking site, for example https://prenota.example.com. Only the scheme, the host and the port are kept.', 'casazen' )
		);
	}

	/**
	 * The field of the organisation slug.
	 *
	 * @return void
	 */
	public static function render_org_slug_field() {
		$settings = Settings::get();
		printf(
			'<input type="text" id="casazen-org-slug" name="%1$s[org_slug]" value="%2$s" class="regular-text code" maxlength="%3$d" autocomplete="off" spellcheck="false" aria-describedby="casazen-org-slug-help" />',
			esc_attr( Settings::OPTION ),
			esc_attr( $settings['org_slug'] ),
			(int) Settings::MAX_SLUG_LENGTH
		);
		printf(
			'<p class="description" id="casazen-org-slug-help">%s</p>',
			esc_html__( 'Only needed when the address above is the CasaZen domain. Lower-case letters, numbers and hyphens.', 'casazen' )
		);
	}

	/**
	 * The field of the language mapping.
	 *
	 * @return void
	 */
	public static function render_language_map_field() {
		$settings = Settings::get();
		printf(
			'<textarea id="casazen-language-map" name="%1$s[language_map]" rows="5" cols="40" class="large-text code" spellcheck="false" aria-describedby="casazen-language-map-help">%2$s</textarea>',
			esc_attr( Settings::OPTION ),
			esc_textarea( Settings::language_map_to_text( $settings['language_map'] ) )
		);
		printf(
			'<p class="description" id="casazen-language-map-help">%s</p>',
			esc_html__( 'One line per language of your site, for example it_IT = it. The value is it, en or auto.', 'casazen' )
		);
	}

	/**
	 * The field that switches the loader script on or off.
	 *
	 * @return void
	 */
	public static function render_load_script_field() {
		$settings = Settings::get();
		printf(
			'<input type="hidden" name="%1$s[load_script]" value="0" /><label for="casazen-load-script"><input type="checkbox" id="casazen-load-script" name="%1$s[load_script]" value="1"%2$s /> %3$s</label>',
			esc_attr( Settings::OPTION ),
			checked( $settings['load_script'], true, false ),
			esc_html__( 'Load the CasaZen script on the pages that use it', 'casazen' )
		);
	}

	/**
	 * After the «Test connection» button: the result of the test. The query string carries only the result code, which is
	 * checked against the known codes before anything is printed.
	 *
	 * @return void
	 */
	private static function render_test_result() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- it only picks which message to show, nothing changes.
		if ( ! isset( $_GET['casazen_result'] ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- same as above.
		$code = sanitize_key( wp_unslash( $_GET['casazen_result'] ) );
		if ( ! in_array( $code, Connection::CODES, true ) ) {
			return;
		}

		$class = 'notice-error';
		if ( 'ok' === $code ) {
			$class = 'notice-success';
		} elseif ( 'embed_disabled' === $code ) {
			$class = 'notice-warning';
		}
		printf(
			'<div class="notice %1$s is-dismissible"><p>%2$s</p></div>',
			esc_attr( $class ),
			esc_html( Connection::message( $code ) )
		);
	}

	/**
	 * The status box: what the last connection test found. It reads the stored result and never calls CasaZen.
	 *
	 * @return void
	 */
	private static function render_status() {
		$settings = Settings::get();
		if ( '' === $settings['address'] ) {
			return;
		}
		$result = Connection::cached();
		?>
		<div class="card" id="casazen-status">
			<h2 class="title"><?php esc_html_e( 'Connection status', 'casazen' ); ?></h2>
			<?php if ( null === $result ) : ?>
				<p><?php esc_html_e( 'No check has been made yet. Use the Test connection button below.', 'casazen' ); ?></p>
			<?php else : ?>
				<p><strong><?php echo esc_html( Connection::message( $result['code'] ) ); ?></strong></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Agency', 'casazen' ); ?></th>
						<td><?php echo esc_html( '' !== $result['agency'] ? $result['agency'] : '-' ); ?></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Embedding', 'casazen' ); ?></th>
						<td><?php echo esc_html( self::on_off_label( $result['embedEnabled'] ) ); ?></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Owner sign-in', 'casazen' ); ?></th>
						<td><?php echo esc_html( self::ready_label( $result['ownerLoginReady'] ) ); ?></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Last check', 'casazen' ); ?></th>
						<td><?php echo esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $result['checkedAt'] ) ); ?></td>
					</tr>
				</table>
			<?php endif; ?>
			<p>
				<?php esc_html_e( 'Script address', 'casazen' ); ?>:
				<code><?php echo esc_html( $settings['address'] . '/embed/v1/embed.js' ); ?></code>
			</p>
		</div>
		<?php
	}

	/**
	 * «On», «Off» or «Unknown» for a value that can be unknown.
	 *
	 * @param bool|null $value The value.
	 * @return string
	 */
	private static function on_off_label( $value ) {
		if ( true === $value ) {
			return __( 'On', 'casazen' );
		}
		if ( false === $value ) {
			return __( 'Off', 'casazen' );
		}
		return __( 'Unknown', 'casazen' );
	}

	/**
	 * «Ready», «Not ready yet» or «Unknown» for a value that can be unknown.
	 *
	 * @param bool|null $value The value.
	 * @return string
	 */
	private static function ready_label( $value ) {
		if ( true === $value ) {
			return __( 'Ready', 'casazen' );
		}
		if ( false === $value ) {
			return __( 'Not ready yet', 'casazen' );
		}
		return __( 'Unknown', 'casazen' );
	}
}
