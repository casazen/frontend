<?php
/**
 * The settings screen: Settings, then CasaZen.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Admin side of the plugin: the settings page with its two tabs («Settings» and «Guided setup»): the button «Connect to CasaZen»
 * or, once the site is connected, the agency and the section «Domain»; the status box and the «Test connection» button; and,
 * under «Advanced», the manual set-up of the address and of the slug.
 *
 * Every action checks the capability and a nonce, every output is escaped where it is printed, and there is no field for a
 * secret: the credential of a connected site (Link) stays on the server and is never printed.
 */
class Admin {

	/**
	 * The capability needed to see the screen and to use its forms.
	 *
	 * @var string
	 */
	const CAPABILITY = 'manage_options';

	/**
	 * The next step that a message can offer: the guided setup.
	 *
	 * @var string
	 */
	const NEXT_SETUP = 'setup';

	/**
	 * The message of the last action of a user is kept in a transient named with this prefix and the id of the user.
	 *
	 * @var string
	 */
	const FLASH_PREFIX = 'casazen_notice_';

	/**
	 * How long the message of an action waits to be shown (5 minutes).
	 *
	 * @var int
	 */
	const FLASH_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * The handle of the script and of the style of the screen.
	 *
	 * @var string
	 */
	const ASSET_HANDLE = 'casazen-admin';

	/**
	 * Slug of the settings page (Settings, then CasaZen).
	 *
	 * @var string
	 */
	const PAGE_SLUG = 'casazen';

	/**
	 * The first tab of the page: the settings and the connection test (the one shown when no tab is asked for).
	 *
	 * @var string
	 */
	const TAB_SETTINGS = 'settings';

	/**
	 * The second tab, `?page=casazen&tab=setup`: the guided setup of the pages and the menu entries.
	 *
	 * @var string
	 */
	const TAB_SETUP = 'setup';

	/**
	 * Action and nonce of the «Test connection» form (`admin-post.php?action=casazen_test_connection`).
	 *
	 * @var string
	 */
	const TEST_ACTION = 'casazen_test_connection';

	/**
	 * Name of the nonce field of the «Test connection» form and of the guided setup form (the settings form has its own, from
	 * the Settings API).
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
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
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
		if ( '' !== self::$page_hook ) {
			add_action( 'load-' . self::$page_hook, array( __CLASS__, 'on_load_page' ) );
		}
		return $hook_suffix;
	}

	/**
	 * Before the screen is printed: the return from the console of CasaZen (it comes back here with its code), then, for a connected
	 * site, a fresh copy of the account (at most once a minute: the domain may have changed in the meantime, or the connection may
	 * have been removed in the console). This is the screen of the administrator: a public page never calls CasaZen.
	 *
	 * @return void
	 */
	public static function on_load_page() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}
		Connect::maybe_handle_return();
		if ( self::TAB_SETTINGS === self::current_tab() && Link::is_connected() ) {
			Account::refresh( Account::STALE_AFTER );
		}
	}

	/**
	 * The script and the style of the screen, only on the screen of the plugin. The script is progressive: every button works
	 * without it, through admin-post. Its data carry the address of admin-ajax and a nonce: never the credential.
	 *
	 * @param string $hook_suffix The screen that is printed.
	 * @return void
	 */
	public static function enqueue_assets( $hook_suffix ) {
		if ( '' === self::$page_hook || self::$page_hook !== $hook_suffix ) {
			return;
		}
		wp_enqueue_style( self::ASSET_HANDLE, CASAZEN_URL . 'assets/admin.css', array(), CASAZEN_VERSION );
		wp_enqueue_script( self::ASSET_HANDLE, CASAZEN_URL . 'assets/admin.js', array(), CASAZEN_VERSION, array( 'in_footer' => true ) );
		wp_localize_script(
			self::ASSET_HANDLE,
			'casazenAdmin',
			array(
				'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
				'nonce'      => wp_create_nonce( Domain::AJAX_NONCE ),
				'copied'     => __( 'Copied to the clipboard', 'casazen' ),
				'copyFailed' => __( 'Cannot copy: select the value by hand', 'casazen' ),
				'checking'   => __( 'Checking…', 'casazen' ),
			)
		);
	}

	/**
	 * The checks of every form of the screen: the capability (403 otherwise) and the nonce of its action.
	 *
	 * @param string $action The action of the form (and of its nonce).
	 * @return void
	 */
	public static function check_request( $action ) {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die(
				esc_html__( 'You do not have permission to do this.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}
		check_admin_referer( $action, self::NONCE_FIELD );
	}

	/**
	 * Keeps the message of an action for the current user, to show it once on the screen.
	 *
	 * @param string $type `success`, `error`, `warning` or `info`.
	 * @param string $text The message: plain text, escaped where it is printed. It never holds the credential.
	 * @param string $next The next step to offer (NEXT_SETUP), or an empty string.
	 * @return void
	 */
	public static function flash( $type, $text, $next = '' ) {
		set_transient(
			self::FLASH_PREFIX . get_current_user_id(),
			array(
				'type' => (string) $type,
				'text' => (string) $text,
				'next' => (string) $next,
			),
			self::FLASH_TTL
		);
	}

	/**
	 * The message of the last action of the current user, once: it is deleted when it is read.
	 *
	 * @return array|null { type, text, next }
	 */
	public static function take_flash() {
		$key   = self::FLASH_PREFIX . get_current_user_id();
		$flash = get_transient( $key );
		delete_transient( $key );
		if ( ! is_array( $flash ) || ! isset( $flash['type'], $flash['text'] ) || ! is_string( $flash['text'] ) || '' === $flash['text'] ) {
			return null;
		}
		return array(
			'type' => in_array( $flash['type'], array( 'success', 'error', 'warning', 'info' ), true ) ? $flash['type'] : 'info',
			'text' => $flash['text'],
			'next' => ( isset( $flash['next'] ) && self::NEXT_SETUP === $flash['next'] ) ? self::NEXT_SETUP : '',
		);
	}

	/**
	 * Back to the screen of the plugin (its first tab), after a form.
	 *
	 * @return void
	 */
	public static function redirect_to_page() {
		wp_safe_redirect( add_query_arg( array( 'page' => self::PAGE_SLUG ), admin_url( 'options-general.php' ) ) );
		exit;
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
	 * Prints the settings page: its tabs and the one that is asked for.
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
		$tab = self::current_tab();
		?>
		<div class="wrap">
			<h1>CasaZen</h1>
			<hr class="wp-header-end" />
			<?php self::render_tabs( $tab ); ?>
			<?php
			if ( self::TAB_SETUP === $tab ) {
				self::render_setup_tab();
			} else {
				self::render_settings_tab();
			}
			?>
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
	 * The tab that is asked for: the guided setup, or (for anything else) the settings.
	 *
	 * @return string One of the TAB constants.
	 */
	private static function current_tab() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- it only picks which tab to show, nothing changes.
		$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : self::TAB_SETTINGS;
		return self::TAB_SETUP === $tab ? self::TAB_SETUP : self::TAB_SETTINGS;
	}

	/**
	 * The address of a tab.
	 *
	 * @param string $tab One of the TAB constants.
	 * @return string
	 */
	private static function tab_url( $tab ) {
		return add_query_arg(
			array(
				'page' => self::PAGE_SLUG,
				'tab'  => $tab,
			),
			admin_url( 'options-general.php' )
		);
	}

	/**
	 * The tabs of the page.
	 *
	 * @param string $current The tab that is shown.
	 * @return void
	 */
	private static function render_tabs( $current ) {
		$tabs = array(
			self::TAB_SETTINGS => __( 'Settings', 'casazen' ),
			self::TAB_SETUP    => __( 'Guided setup', 'casazen' ),
		);

		echo '<nav class="nav-tab-wrapper">';
		foreach ( $tabs as $tab => $label ) {
			printf(
				'<a href="%1$s" class="nav-tab%2$s"%3$s>%4$s</a>',
				esc_url( self::tab_url( $tab ) ),
				$tab === $current ? ' nav-tab-active' : '',
				$tab === $current ? ' aria-current="page"' : '',
				esc_html( $label )
			);
		}
		echo '</nav>';
	}

	/**
	 * The first tab: the message of the last action, the result of the last test, «Connect to CasaZen» (or the agency and its
	 * domain), the status, the «Test connection» form and, under «Advanced», the settings form. It reads what is stored: printing the
	 * screen never calls CasaZen.
	 *
	 * @return void
	 */
	private static function render_settings_tab() {
		$flash = self::take_flash();
		self::render_flash( $flash );
		self::render_test_result();

		$link = Link::summary();
		if ( null === $link ) {
			self::render_connect_card();
		} else {
			self::render_account_card( $link );
			self::render_domain_section( Account::cached(), null !== $flash && self::NEXT_SETUP === $flash['next'] );
		}

		self::render_status();
		?>
		<h2><?php esc_html_e( 'Test connection', 'casazen' ); ?></h2>
		<p><?php esc_html_e( 'Check now that this site can reach your CasaZen address.', 'casazen' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php?action=' . self::TEST_ACTION ) ); ?>">
			<?php
			wp_nonce_field( self::TEST_ACTION, self::NONCE_FIELD );
			submit_button( __( 'Test connection', 'casazen' ), 'secondary', 'casazen_test_submit', false );
			?>
		</form>

		<?php
		// After a save the section is open: the messages of the settings are about its fields.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- it only decides whether the section starts open, nothing changes.
		$open = isset( $_GET['settings-updated'] );
		?>
		<details class="casazen-advanced" id="casazen-advanced"<?php echo $open ? ' open' : ''; ?>>
			<summary><?php esc_html_e( 'Advanced: manual set-up', 'casazen' ); ?></summary>
			<p class="description">
				<?php
				if ( null === $link ) {
					esc_html_e( 'Without connecting the site, write the address of your CasaZen booking site (and, on the CasaZen address, the slug of your organisation) yourself.', 'casazen' );
				} else {
					esc_html_e( 'This site is connected: CasaZen fills in the address and the slug by itself. Change them here only if CasaZen asks you to.', 'casazen' );
				}
				?>
			</p>
			<form method="post" action="options.php">
				<?php
				settings_fields( Settings::GROUP );
				do_settings_sections( self::PAGE_SLUG );
				submit_button();
				?>
			</form>
		</details>
		<?php
	}

	/**
	 * The message of the last action (once), with the next step when it offers one.
	 *
	 * @param array|null $flash The message of take_flash().
	 * @return void
	 */
	private static function render_flash( $flash ) {
		if ( null === $flash ) {
			return;
		}
		printf(
			'<div class="notice notice-%1$s casazen-flash" id="casazen-flash"%2$s><p>%3$s</p>',
			esc_attr( $flash['type'] ),
			'error' === $flash['type'] ? ' role="alert"' : '',
			esc_html( $flash['text'] )
		);
		if ( self::NEXT_SETUP === $flash['next'] ) {
			printf(
				'<p>%1$s</p><p><a class="button button-primary" href="%2$s">%3$s</a></p>',
				esc_html__( 'Next step: create the pages of your booking site.', 'casazen' ),
				esc_url( self::tab_url( self::TAB_SETUP ) ),
				esc_html__( 'Open the guided setup', 'casazen' )
			);
		}
		echo '</div>';
	}

	/**
	 * A hidden nonce field for the forms of the screen (without the id that wp_nonce_field() repeats on every form).
	 *
	 * @param string $action The action of the form.
	 * @return void
	 */
	private static function nonce_field( $action ) {
		printf(
			'<input type="hidden" name="%1$s" value="%2$s" />',
			esc_attr( self::NONCE_FIELD ),
			esc_attr( wp_create_nonce( $action ) )
		);
	}

	/**
	 * A form of admin-post with its nonce and one button.
	 *
	 * @param string $action The action of the form (and of its nonce).
	 * @param string $label  The text of the button.
	 * @param string $type   The classes of the button for submit_button(): `primary`, `secondary`, `primary large`.
	 * @param string $extra  Attributes of the form, already escaped (for the script of the screen).
	 * @return void
	 */
	private static function action_form( $action, $label, $type = 'secondary', $extra = '' ) {
		printf(
			'<form method="post" class="casazen-inline-form" action="%1$s"%2$s>',
			esc_url( admin_url( 'admin-post.php?action=' . $action ) ),
			$extra // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixed attributes written by this class.
		);
		self::nonce_field( $action );
		submit_button( $label, $type, $action . '_submit', false );
		echo '</form>';
	}

	/**
	 * Before the site is connected: the one button «Connect to CasaZen» (and, when CasaZen no longer accepts the site, why).
	 *
	 * @return void
	 */
	private static function render_connect_card() {
		$revoked = Link::revoked();
		?>
		<div class="card casazen-card" id="casazen-connect">
			<h2 class="title"><?php esc_html_e( 'Connect this site to CasaZen', 'casazen' ); ?></h2>
			<?php if ( null !== $revoked ) : ?>
				<div class="notice notice-warning inline" id="casazen-revoked" role="status">
					<p><strong><?php esc_html_e( 'No longer connected', 'casazen' ); ?></strong></p>
					<p>
						<?php
						if ( '' !== $revoked ) {
							printf(
								/* translators: %s: the name of the agency in CasaZen. */
								esc_html__( 'CasaZen does not accept this site for %s any more: the connection was removed in the CasaZen console. Your settings were kept: connect the site again to manage the domain from here.', 'casazen' ),
								esc_html( $revoked )
							);
						} else {
							esc_html_e( 'CasaZen does not accept this site any more: the connection was removed in the CasaZen console. Your settings were kept: connect the site again to manage the domain from here.', 'casazen' );
						}
						?>
					</p>
				</div>
			<?php endif; ?>
			<p><?php esc_html_e( 'One button: CasaZen opens, you confirm, and the address of your booking site is filled in here by itself. Then you manage your domain from this screen.', 'casazen' ); ?></p>
			<?php self::action_form( Connect::START_ACTION, __( 'Connect to CasaZen', 'casazen' ), 'primary large' ); ?>
			<p class="description"><?php esc_html_e( 'You need to be an administrator of your agency in CasaZen. Without connecting, you can set the address by hand under Advanced.', 'casazen' ); ?></p>
		</div>
		<?php
	}

	/**
	 * The site is connected: the agency and the address of the site (nothing else of the link), and «Disconnect».
	 *
	 * @param array $link The link of Link::summary() (no credential in it).
	 * @return void
	 */
	private static function render_account_card( array $link ) {
		?>
		<div class="card casazen-card" id="casazen-account">
			<h2 class="title">
				<?php
				printf(
					/* translators: %s: the name of the agency in CasaZen. */
					esc_html__( 'Connected to %s', 'casazen' ),
					esc_html( $link['org_name'] )
				);
				?>
			</h2>
			<p><?php esc_html_e( 'Site', 'casazen' ); ?>: <code><?php echo esc_html( $link['site_url'] ); ?></code></p>
			<details class="casazen-confirm">
				<summary><?php esc_html_e( 'Disconnect', 'casazen' ); ?></summary>
				<p><?php esc_html_e( 'The site stops managing the domain from here and CasaZen forgets its credential. The address and the settings stay, so the widgets keep working.', 'casazen' ); ?></p>
				<?php self::action_form( Connect::DISCONNECT_ACTION, __( 'Yes, disconnect', 'casazen' ) ); ?>
			</details>
		</div>
		<?php
	}

	/**
	 * The section «Domain» of a connected site, from the copy of the account (Account::cached()): the domain of the agency, its DNS
	 * records with their copy buttons, its state, «Check now», «Remove domain» and what passes from it. Without the plan for a
	 * custom domain: the Pro message and a link to the console, no form.
	 *
	 * @param array|null $account       The copy of the account, or null when CasaZen could not be read.
	 * @param bool       $after_connect Whether the screen comes right after the connection (the guided setup is then the next step).
	 * @return void
	 */
	private static function render_domain_section( $account, $after_connect ) {
		$state   = Account::domain_state( $account );
		$pending = Account::is_pending( $account );
		printf(
			'<div class="card casazen-card" id="casazen-domain" data-casazen-state="%1$s"%2$s>',
			esc_attr( $state ),
			$pending ? ' data-casazen-poll="1" data-casazen-fingerprint="' . esc_attr( Account::fingerprint( $account ) ) . '"' : '' // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in place.
		);
		echo '<h2 class="title">' . esc_html__( 'Domain', 'casazen' ) . '</h2>';

		if ( null === $account ) {
			echo '<p>' . esc_html__( 'The data of your domain could not be read from CasaZen. Try again in a few minutes.', 'casazen' ) . '</p>';
			self::action_form( Domain::REFRESH_ACTION, __( 'Reload the data', 'casazen' ) );
			echo '</div>';
			return;
		}

		if ( '' !== $account['error'] ) {
			printf(
				'<div class="notice notice-warning inline"><p>%1$s %2$s</p></div>',
				esc_html__( 'These data may not be up to date:', 'casazen' ),
				esc_html( Api_Client::message( $account['error'] ) )
			);
		}

		printf(
			'<p>%s</p>',
			sprintf(
				/* translators: %s: the address of the booking site of the agency. */
				esc_html__( 'Your booking site answers on %s.', 'casazen' ),
				'<code>' . esc_html( $account['public_address'] ) . '</code>'
			)
		);

		$domain = $account['domain'];
		if ( ! $domain['can_use_custom_domain'] ) {
			printf(
				'<p><strong>%1$s</strong></p><p><a class="button" href="%2$s" target="_blank" rel="noopener noreferrer">%3$s</a></p>',
				esc_html( Api_Client::message( 'plan_required' ) ),
				esc_url( self::console_domain_url() ),
				esc_html__( 'Open the domain settings in CasaZen', 'casazen' )
			);
			echo '</div>';
			return;
		}

		if ( 'none' === $state ) {
			echo '<p>' . esc_html__( 'To use an address of your own, such as prenota.example.com, write it here. Then you create two DNS records where your domain is managed.', 'casazen' ) . '</p>';
			self::render_domain_form( '', $after_connect ? 'secondary' : 'primary' );
			echo '</div>';
			return;
		}

		printf(
			'<p>%1$s: <strong>%2$s</strong></p>',
			esc_html__( 'Your domain', 'casazen' ),
			esc_html( $domain['custom_domain'] )
		);
		self::render_domain_state( $account, $state );
		if ( 'verified' !== $state ) {
			if ( null !== $domain['dns'] ) {
				self::render_dns_records( $domain['dns'] );
			}
			self::action_form( Domain::VERIFY_ACTION, __( 'Check now', 'casazen' ), 'secondary', ' data-casazen-verify="1"' );
		}
		if ( 'failed' === $state ) {
			self::render_domain_form( $domain['custom_domain'], 'secondary' );
		}
		?>
		<details class="casazen-confirm">
			<summary><?php esc_html_e( 'Remove domain', 'casazen' ); ?></summary>
			<p><?php esc_html_e( 'Your booking site goes back to the CasaZen address, and this site follows it by itself. The DNS records can then be deleted.', 'casazen' ); ?></p>
			<?php self::action_form( Domain::REMOVE_ACTION, __( 'Yes, remove the domain', 'casazen' ) ); ?>
		</details>
		<?php
		if ( null !== $domain['surfaces'] ) {
			self::render_surfaces( $domain );
		}
		echo '</div>';
	}

	/**
	 * The field of the domain and «Connect domain».
	 *
	 * @param string $value  The domain to show in the field.
	 * @param string $button The classes of the button: `primary`, or `secondary` when another step is the one to take first.
	 * @return void
	 */
	private static function render_domain_form( $value, $button ) {
		?>
		<form method="post" class="casazen-domain-form" action="<?php echo esc_url( admin_url( 'admin-post.php?action=' . Domain::SAVE_ACTION ) ); ?>">
			<?php self::nonce_field( Domain::SAVE_ACTION ); ?>
			<p>
				<label for="casazen-domain-field"><?php esc_html_e( 'Your domain', 'casazen' ); ?></label><br />
				<input type="text" id="casazen-domain-field" name="<?php echo esc_attr( Domain::DOMAIN_FIELD ); ?>" value="<?php echo esc_attr( $value ); ?>" class="regular-text code" placeholder="prenota.example.com" maxlength="253" autocomplete="off" spellcheck="false" required aria-describedby="casazen-domain-help" />
			</p>
			<p class="description" id="casazen-domain-help"><?php esc_html_e( 'The address where your guests book, without https://, for example prenota.example.com.', 'casazen' ); ?></p>
			<?php submit_button( __( 'Connect domain', 'casazen' ), $button, Domain::SAVE_ACTION . '_submit', false ); ?>
		</form>
		<?php
	}

	/**
	 * The state of the domain, with the words of the console: its title, why (the explanation that CasaZen gives), the last check and
	 * whether CasaZen checks it by itself.
	 *
	 * @param array  $account The copy of the account.
	 * @param string $state   The state of Account::domain_state().
	 * @return void
	 */
	private static function render_domain_state( array $account, $state ) {
		$status       = $account['domain']['status'];
		$titles       = array(
			'verified'   => __( 'Your domain is active', 'casazen' ),
			'waiting'    => __( 'Waiting for the DNS records', 'casazen' ),
			'activating' => __( 'Activation in progress', 'casazen' ),
			'failed'     => __( 'The domain cannot be activated', 'casazen' ),
		);
		$descriptions = array(
			'verified'   => __( 'Your guests can book from your domain. We keep checking the DNS records: if they are removed, the domain stops being active.', 'casazen' ),
			'waiting'    => __( 'Create the DNS records shown below at your provider and wait for them to propagate (it can take a few hours). Then press Check now, or wait for the automatic check.', 'casazen' ),
			'activating' => __( 'The DNS records are not the problem: we are finishing the activation of the domain on the platform and will retry automatically.', 'casazen' ),
			'failed'     => __( 'The domain cannot be activated. Check that it is spelled correctly or choose another domain.', 'casazen' ),
		);
		$explanation  = 'verified' === $state ? '' : $status['message'];
		$last_check   = Domain::last_check( $account );

		printf(
			'<div class="casazen-domain-state casazen-domain-state--%1$s" role="%2$s"><p><strong>%3$s</strong></p><p>%4$s</p></div>',
			esc_attr( $state ),
			'failed' === $state ? 'alert' : 'status',
			esc_html( $titles[ $state ] ),
			esc_html( '' !== $explanation ? $explanation : $descriptions[ $state ] )
		);
		if ( ! $status['activation_available'] ) {
			echo '<p class="description">' . esc_html__( 'Activating custom domains is not available on the platform yet: the domain will stay on hold until the service is configured. There is nothing different to do on your DNS.', 'casazen' ) . '</p>';
		}
		printf(
			'<p class="description">%1$s: <span data-casazen-last-check>%2$s</span>. %3$s</p>',
			esc_html__( 'Last check', 'casazen' ),
			esc_html( '' !== $last_check ? $last_check : __( 'not checked yet', 'casazen' ) ),
			esc_html(
				$status['auto_check_active']
					? __( 'We re-check the domain automatically: you do not need to come back here.', 'casazen' )
					: __( 'The automatic check is paused because the domain has not been configured for too long: press Check now after fixing the DNS records.', 'casazen' )
			)
		);
	}

	/**
	 * The DNS records to create, exactly as CasaZen gives them, each name and value with its copy button (shown by the script).
	 *
	 * @param array $dns The records of the copy of the account.
	 * @return void
	 */
	private static function render_dns_records( array $dns ) {
		echo '<h3>' . esc_html__( 'DNS records to create', 'casazen' ) . '</h3>';
		echo '<p>' . esc_html__( 'Create these records at the provider of your domain (where you registered it). Then press Check now.', 'casazen' ) . '</p>';
		echo '<table class="widefat striped casazen-dns" id="casazen-dns"><thead><tr>';
		printf(
			'<th scope="col">%1$s</th><th scope="col">%2$s</th><th scope="col">%3$s</th>',
			esc_html__( 'Record', 'casazen' ),
			esc_html__( 'Name', 'casazen' ),
			esc_html__( 'Value', 'casazen' )
		);
		echo '</tr></thead><tbody>';

		self::render_dns_row( __( '1. Ownership TXT record', 'casazen' ), __( 'Proves the domain is yours. Type TXT.', 'casazen' ), $dns['txt_host'], $dns['txt_value'] );
		self::render_dns_row( __( '2. CNAME record', 'casazen' ), __( 'Points the domain to our service. Type CNAME, for a subdomain such as www.', 'casazen' ), $dns['cname_host'], $dns['cname_target'] );
		foreach ( $dns['a_records'] as $index => $address ) {
			self::render_dns_row(
				0 === $index ? __( 'Alternatively: A record', 'casazen' ) : '',
				0 === $index ? __( 'For a domain without www (the root of a domain cannot have a CNAME) create a record of type A for each address.', 'casazen' ) : '',
				$dns['cname_host'],
				$address
			);
		}
		if ( '' !== $dns['provider_txt_host'] && '' !== $dns['provider_txt_value'] ) {
			self::render_dns_row( __( '3. Service provider TXT record', 'casazen' ), __( 'Required only because the domain is already used on another account of the provider. Type TXT.', 'casazen' ), $dns['provider_txt_host'], $dns['provider_txt_value'] );
		}
		echo '</tbody></table>';
		echo '<p class="description">' . esc_html__( 'The SSL certificate is generated automatically once the domain is active.', 'casazen' ) . '</p>';
	}

	/**
	 * One row of the DNS records.
	 *
	 * @param string $label The record.
	 * @param string $hint  What it is for (may be empty).
	 * @param string $name  The name (host) of the record.
	 * @param string $value The value of the record.
	 * @return void
	 */
	private static function render_dns_row( $label, $hint, $name, $value ) {
		if ( '' === $name || '' === $value ) {
			return;
		}
		printf(
			'<tr><th scope="row">%1$s%2$s</th><td><code>%3$s</code> %4$s</td><td><code>%5$s</code> %6$s</td></tr>',
			esc_html( $label ),
			'' !== $hint ? '<br /><span class="description">' . esc_html( $hint ) . '</span>' : '',
			esc_html( $name ),
			self::copy_button( $name, __( 'Copy the name', 'casazen' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in copy_button().
			esc_html( $value ),
			self::copy_button( $value, __( 'Copy the value', 'casazen' ) ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in copy_button().
		);
	}

	/**
	 * A copy button. It starts hidden: the script of the screen shows it (without the script the value is selected by hand).
	 *
	 * @param string $value The text to copy.
	 * @param string $label The text of the button.
	 * @return string HTML, already escaped.
	 */
	private static function copy_button( $value, $label ) {
		return sprintf(
			'<button type="button" class="button button-small casazen-copy" data-casazen-copy="%1$s" hidden>%2$s</button><span class="casazen-copy-status" aria-live="polite"></span>',
			esc_attr( $value ),
			esc_html( $label )
		);
	}

	/**
	 * What passes from the domain (the three choices of the agency, with the words of the console) and the state of the sign-in of
	 * the owners, as read-only text.
	 *
	 * @param array $domain The domain of the copy of the account.
	 * @return void
	 */
	private static function render_surfaces( array $domain ) {
		$surfaces  = $domain['surfaces'];
		$effective = $surfaces['effective'];

		$links_note = '';
		if ( $effective['links'] && '' !== $domain['custom_domain_url'] ) {
			/* translators: %s: the address of the domain of the agency. */
			$links_note = sprintf( __( 'The links you send start from %s.', 'casazen' ), $domain['custom_domain_url'] );
		} elseif ( $surfaces['links'] && ! $effective['links'] ) {
			$links_note = __( 'For now the links stay the CasaZen ones.', 'casazen' );
		}
		$choices      = array(
			'guest_area'   => array(
				'label' => __( 'Guest area on my domain', 'casazen' ),
				'help'  => __( 'Your guests manage their booking and check in from your address, under your brand.', 'casazen' ),
				'note'  => $surfaces['guest_area'] && ! $effective['guest_area'] ? __( 'For now the guest area stays on the CasaZen address.', 'casazen' ) : '',
			),
			'owner_portal' => array(
				'label' => __( 'Owner portal on my domain', 'casazen' ),
				'help'  => __( 'Owners sign in from your address. Their links move only once owner sign-in is active.', 'casazen' ),
				'note'  => $surfaces['owner_portal'] && ! ( $effective['owner_portal'] && $effective['owner_login'] ) ? __( 'For now the owner portal stays on the CasaZen address.', 'casazen' ) : '',
			),
			'links'        => array(
				'label' => __( 'Use my domain in the links I send', 'casazen' ),
				'help'  => __( 'Check-in, booking management, confirmations and invitations start from your address instead of the CasaZen one.', 'casazen' ),
				'note'  => $links_note,
			),
		);
		$owner_states = array(
			'failed'           => __( 'registration failed', 'casazen' ),
			'notRequested'     => __( 'not requested yet', 'casazen' ),
			'pendingAutomatic' => __( 'registration in progress', 'casazen' ),
			'pendingManual'    => __( 'waiting for CasaZen to enable it', 'casazen' ),
			'ready'            => __( 'active', 'casazen' ),
		);
		$owner_state  = self::owner_login_line( $surfaces );
		?>
		<h3><?php esc_html_e( 'What runs on your domain', 'casazen' ); ?></h3>
		<p><?php esc_html_e( 'Choose what runs on your address. Anything you leave off stays on the CasaZen address.', 'casazen' ); ?></p>
		<form method="post" class="casazen-surfaces" id="casazen-surfaces" action="<?php echo esc_url( admin_url( 'admin-post.php?action=' . Domain::SURFACES_ACTION ) ); ?>">
			<?php self::nonce_field( Domain::SURFACES_ACTION ); ?>
			<fieldset>
				<legend class="screen-reader-text"><?php esc_html_e( 'What runs on your domain', 'casazen' ); ?></legend>
				<?php foreach ( $choices as $key => $choice ) : ?>
					<p>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( Domain::SURFACES_FIELD . '[' . $key . ']' ); ?>" value="1"<?php checked( $surfaces[ $key ] ); ?> />
							<?php echo esc_html( $choice['label'] ); ?>
						</label>
						<br /><span class="description"><?php echo esc_html( $choice['help'] ); ?></span>
						<?php if ( '' !== $choice['note'] ) : ?>
							<br /><strong class="casazen-note"><?php echo esc_html( $choice['note'] ); ?></strong>
						<?php endif; ?>
					</p>
				<?php endforeach; ?>
			</fieldset>
			<?php submit_button( __( 'Save the choices', 'casazen' ), 'secondary', Domain::SURFACES_ACTION . '_submit', false ); ?>
		</form>
		<p id="casazen-owner-login">
			<strong><?php esc_html_e( 'Owner sign-in', 'casazen' ); ?>:</strong>
			<?php echo esc_html( $owner_states[ $owner_state ] ); ?>
			<?php if ( 'pendingManual' === $owner_state ) : ?>
				<br /><span class="description"><?php esc_html_e( 'CasaZen enables it: there is nothing for you to do.', 'casazen' ); ?></span>
			<?php endif; ?>
		</p>
		<?php
	}

	/**
	 * The state of the sign-in of the owners, as the line says it: one per state of CasaZen, and two for `Pending` (CasaZen enables it
	 * by hand, or it registers by itself).
	 *
	 * @param array $surfaces The surfaces of the copy of the account.
	 * @return string `failed`, `notRequested`, `pendingAutomatic`, `pendingManual` or `ready`.
	 */
	private static function owner_login_line( array $surfaces ) {
		switch ( $surfaces['owner_login'] ) {
			case 'Pending':
				return $surfaces['owner_automatic'] ? 'pendingAutomatic' : 'pendingManual';
			case 'Ready':
				return 'ready';
			case 'Failed':
				return 'failed';
			default:
				return 'notRequested';
		}
	}

	/**
	 * The domain page of the console of the connected site (or of this install).
	 *
	 * @return string
	 */
	private static function console_domain_url() {
		$link   = Link::summary();
		$origin = ( null !== $link && '' !== $link['app_origin'] ) ? $link['app_origin'] : Build_Config::app_origin();
		return $origin . '/app/short-rent/settings/domain';
	}

	/**
	 * The second tab: the result of the last run (once), then the form, or the request to test the connection first.
	 *
	 * @return void
	 */
	private static function render_setup_tab() {
		$result = Wizard::take_result();
		?>
		<h2><?php esc_html_e( 'Guided setup', 'casazen' ); ?></h2>
		<p><?php esc_html_e( 'Creates the pages of your booking site and adds them to a menu. A page that already exists is never changed, and nothing is deleted or moved.', 'casazen' ); ?></p>
		<?php
		// What the last run left is only shown: the setup finds its pages by their role, never by this note.
		$state = Wizard::state();
		if ( ! empty( $state['time'] ) ) {
			printf(
				'<p class="description">%s</p>',
				sprintf(
					/* translators: %s: the date and time of the last run of the guided setup. */
					esc_html__( 'Last run: %s.', 'casazen' ),
					esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $state['time'] ) )
				)
			);
		}

		if ( null !== $result ) {
			self::render_wizard_result( $result );
		}

		$connection = Connection::cached();
		if ( ! is_array( $connection ) || empty( $connection['ok'] ) ) {
			?>
			<div class="notice notice-warning inline">
				<p><strong><?php esc_html_e( 'Run the connection test first', 'casazen' ); ?></strong></p>
				<p><a href="<?php echo esc_url( self::tab_url( self::TAB_SETTINGS ) ); ?>"><?php esc_html_e( 'Open the Settings tab', 'casazen' ); ?></a></p>
			</div>
			<?php
		} else {
			self::render_wizard_form();
		}

		self::render_search_bar_hint();
	}

	/**
	 * The names of the three pages, by role.
	 *
	 * @return string[]
	 */
	private static function role_labels() {
		return array(
			Pages::ROLE_BOOKING      => __( 'Booking page', 'casazen' ),
			Pages::ROLE_GUEST_ACCESS => __( 'Guest access page', 'casazen' ),
			Pages::ROLE_OWNER_AREA   => __( 'Owner area page', 'casazen' ),
		);
	}

	/**
	 * The form of the guided setup.
	 *
	 * @return void
	 */
	private static function render_wizard_form() {
		$titles = Wizard::default_titles();
		$labels = self::role_labels();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php?action=' . Wizard::ACTION ) ); ?>">
			<?php wp_nonce_field( Wizard::ACTION, self::NONCE_FIELD ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Pages', 'casazen' ); ?></th>
					<td>
						<fieldset>
							<legend class="screen-reader-text"><span><?php esc_html_e( 'Pages', 'casazen' ); ?></span></legend>
							<?php foreach ( Pages::roles() as $role ) : ?>
								<?php $existing = Pages::find( $role, 'any' ); ?>
								<p>
									<label>
										<input type="checkbox" name="casazen_wizard[pages][<?php echo esc_attr( $role ); ?>][enabled]" value="1" checked="checked" />
										<?php echo esc_html( $labels[ $role ] ); ?>
									</label>
									<br />
									<label for="casazen-wizard-title-<?php echo esc_attr( $role ); ?>"><?php esc_html_e( 'Title', 'casazen' ); ?></label>
									<input type="text" class="regular-text" id="casazen-wizard-title-<?php echo esc_attr( $role ); ?>" name="casazen_wizard[pages][<?php echo esc_attr( $role ); ?>][title]" value="<?php echo esc_attr( $titles[ $role ] ); ?>" maxlength="200" />
									<?php if ( $existing > 0 ) : ?>
										<br />
										<span class="description">
											<?php
											printf(
												/* translators: %s: the title of the page that already exists, as a link. */
												esc_html__( 'A page for this already exists: %s. It will not be changed.', 'casazen' ),
												'<a href="' . esc_url( (string) get_permalink( $existing ) ) . '">' . esc_html( get_the_title( $existing ) ) . '</a>'
											);
											?>
										</span>
									<?php endif; ?>
								</p>
							<?php endforeach; ?>
						</fieldset>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Publication', 'casazen' ); ?></th>
					<td>
						<label>
							<input type="checkbox" name="casazen_wizard[publish]" value="1" checked="checked" />
							<?php esc_html_e( 'Publish the pages now', 'casazen' ); ?>
						</label>
						<p class="description"><?php esc_html_e( 'Without the tick the pages are saved as drafts.', 'casazen' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="casazen-wizard-menu"><?php esc_html_e( 'Menu', 'casazen' ); ?></label></th>
					<td>
						<select name="casazen_wizard[menu]" id="casazen-wizard-menu">
							<option value="0"><?php esc_html_e( 'Do not add menu entries', 'casazen' ); ?></option>
							<?php foreach ( Wizard::menus() as $menu ) : ?>
								<option value="<?php echo esc_attr( (string) (int) $menu->term_id ); ?>"><?php echo esc_html( $menu->name ); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description"><?php esc_html_e( 'The pages are added at the end of the menu. The entries that are already there are never moved, renamed or removed.', 'casazen' ); ?></p>
						<?php if ( Wizard::is_block_theme() ) : ?>
							<p class="description"><?php esc_html_e( 'Your theme is a block theme: its menus are edited in the Site Editor. If you choose no menu here, the pages are listed so that you can add them there.', 'casazen' ); ?></p>
						<?php endif; ?>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Create the pages', 'casazen' ) ); ?>
		</form>
		<?php
	}

	/**
	 * What the last run did, page by page. Everything that comes from the result is escaped where it is printed.
	 *
	 * @param array $result The result of Wizard::run() (or of the form that refused to run it).
	 * @return void
	 */
	private static function render_wizard_result( array $result ) {
		if ( ! empty( $result['error'] ) ) {
			$message = 'unknown_menu' === $result['error']
				? __( 'The menu you chose does not exist. Nothing was created.', 'casazen' )
				: __( 'Run the connection test first', 'casazen' );
			printf( '<div class="notice notice-error inline"><p>%s</p></div>', esc_html( $message ) );
			return;
		}

		$labels  = self::role_labels();
		$items   = ( isset( $result['menu']['items'] ) && is_array( $result['menu']['items'] ) ) ? $result['menu']['items'] : array();
		$outcome = self::wizard_outcome( $result );

		// The box says how the run went: green only when everything that was asked is there.
		switch ( $outcome ) {
			case 'failed':
				$class = 'notice-error';
				$title = __( 'The setup is not complete.', 'casazen' );
				break;
			case 'nothing':
				$class = 'notice-warning';
				$title = __( 'Nothing was done: no page was ticked.', 'casazen' );
				break;
			case 'attention':
				$class = 'notice-warning';
				$title = __( 'The setup is done, but a page is not published yet.', 'casazen' );
				break;
			default:
				$class = 'notice-success';
				$title = __( 'The setup is done.', 'casazen' );
		}

		printf( '<div class="notice %s inline" id="casazen-wizard-result">', esc_attr( $class ) );
		echo '<p><strong>' . esc_html( $title ) . '</strong></p><ul>';
		foreach ( Pages::roles() as $role ) {
			if ( ! isset( $result['pages'][ $role ] ) || ! is_array( $result['pages'][ $role ] ) ) {
				continue;
			}
			echo '<li>' . self::wizard_page_line( $labels[ $role ], $result['pages'][ $role ], isset( $items[ $role ] ) ? (string) $items[ $role ] : '' ) . '</li>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped piece by piece in wizard_page_line().
		}
		echo '</ul>';
		if ( 'failed' === $outcome ) {
			echo '<p>' . esc_html__( 'What was made is kept and nothing is made twice: run the setup again when the problem is solved.', 'casazen' ) . '</p>';
		}

		if ( isset( $result['menu']['name'] ) ) {
			printf(
				'<p>%s</p>',
				sprintf(
					/* translators: %s: the name of a menu. */
					esc_html__( 'Menu: %s', 'casazen' ),
					'<strong>' . esc_html( (string) $result['menu']['name'] ) . '</strong>'
				)
			);
		}
		if ( ! empty( $result['block_theme'] ) ) {
			echo '<p>' . esc_html__( 'Your theme is a block theme, so no menu was changed. Add them to the Navigation block in the Site Editor.', 'casazen' ) . '</p>';
		}
		if ( ! empty( $result['polylang'] ) ) {
			echo '<p>' . esc_html__( 'The pages are in the default language. Translate the pages from the Polylang screen.', 'casazen' ) . '</p>';
		}
		echo '</div>';
	}

	/**
	 * How a run of the setup went, for the colour and the title of its result box.
	 *
	 * - `failed`: a page or a menu entry that was asked for could not be made.
	 * - `nothing`: no page was ticked, so nothing was done.
	 * - `attention`: everything was made, but a page that already existed is not published. The setup never changes such a page, and
	 *   the widget is not on the site until its owner publishes it.
	 * - `done`: everything that was asked is there. A page that the setup made as a draft because the box «Publish the pages now» was
	 *   not ticked is what was asked for.
	 *
	 * @param array $result The result of Wizard::run().
	 * @return string One of `failed`, `nothing`, `attention` and `done`.
	 */
	private static function wizard_outcome( array $result ) {
		$items   = ( isset( $result['menu']['items'] ) && is_array( $result['menu']['items'] ) ) ? $result['menu']['items'] : array();
		$chosen  = 0;
		$failed  = false;
		$waiting = false;

		foreach ( Pages::roles() as $role ) {
			if ( ! isset( $result['pages'][ $role ] ) || ! is_array( $result['pages'][ $role ] ) ) {
				continue;
			}
			$page   = $result['pages'][ $role ];
			$status = isset( $page['status'] ) ? $page['status'] : '';
			if ( 'skipped' === $status ) {
				continue;
			}

			++$chosen;
			if ( ! in_array( $status, array( 'created', 'exists' ), true ) || empty( $page['id'] ) ) {
				$failed = true;
				continue;
			}
			if ( isset( $items[ $role ] ) && 'failed' === $items[ $role ] ) {
				$failed = true;
			}
			if ( 'exists' === $status && isset( $page['post_status'] ) && 'publish' !== $page['post_status'] ) {
				$waiting = true;
			}
		}

		if ( $failed ) {
			return 'failed';
		}
		if ( 0 === $chosen ) {
			return 'nothing';
		}
		return $waiting ? 'attention' : 'done';
	}

	/**
	 * One line of the result: the page with its link, what happened to it and to its menu entry.
	 *
	 * @param string $label      The name of the role.
	 * @param array  $page       The description of the page (see Wizard::run()).
	 * @param string $menu_state `added`, `exists`, `failed` or an empty string when no menu was chosen.
	 * @return string HTML, already escaped.
	 */
	private static function wizard_page_line( $label, array $page, $menu_state ) {
		$prefix = '<strong>' . esc_html( $label ) . '</strong>: ';
		$status = isset( $page['status'] ) ? $page['status'] : '';

		if ( 'skipped' === $status ) {
			return $prefix . esc_html__( 'Skipped.', 'casazen' );
		}
		if ( ! in_array( $status, array( 'created', 'exists' ), true ) || empty( $page['id'] ) ) {
			return $prefix . esc_html__( 'The page could not be created.', 'casazen' );
		}

		$url   = isset( $page['url'] ) ? (string) $page['url'] : '';
		$title = isset( $page['title'] ) ? (string) $page['title'] : '';
		$line  = $prefix . '<a href="' . esc_url( $url ) . '">' . esc_html( $title ) . '</a> ';

		if ( 'created' === $status ) {
			$line .= esc_html__( 'Page created.', 'casazen' );
			if ( isset( $page['post_status'] ) && 'draft' === $page['post_status'] ) {
				$line .= ' ' . esc_html__( 'It is a draft: publish it when you are ready.', 'casazen' );
			}
			if ( ! empty( $page['wanted_slug'] ) && isset( $page['slug'] ) && $page['wanted_slug'] !== $page['slug'] ) {
				$line .= ' ' . sprintf(
					/* translators: 1: the address the title asked for, 2: the address the page got. */
					esc_html__( 'The address "%1$s" belongs to another page, so this page uses "%2$s".', 'casazen' ),
					esc_html( (string) $page['wanted_slug'] ),
					esc_html( (string) $page['slug'] )
				);
			}
		} else {
			$line .= esc_html__( 'The page already exists and was not changed.', 'casazen' );
			// The setup never changes a page that exists, so a page that is not published stays so: say it, the widget is not on the site.
			if ( isset( $page['post_status'] ) && 'publish' !== $page['post_status'] ) {
				$line .= ' ' . esc_html__( 'It is not published, so your visitors do not see it: publish it from the page editor.', 'casazen' );
			}
		}

		if ( 'added' === $menu_state ) {
			$line .= ' ' . esc_html__( 'Added to the menu.', 'casazen' );
		} elseif ( 'exists' === $menu_state ) {
			$line .= ' ' . esc_html__( 'Already in the menu.', 'casazen' );
		} elseif ( 'failed' === $menu_state ) {
			$line .= ' ' . esc_html__( 'Could not be added to the menu.', 'casazen' );
		}
		return $line;
	}

	/**
	 * The hint about the search bar of the home page, below the form.
	 *
	 * @return void
	 */
	private static function render_search_bar_hint() {
		$booking = Pages::find( Pages::ROLE_BOOKING, 'any' );
		$titles  = Wizard::default_titles();
		$name    = $booking > 0 ? get_the_title( $booking ) : $titles[ Pages::ROLE_BOOKING ];

		echo '<h3>' . esc_html__( 'Hero search bar', 'casazen' ) . '</h3>';
		printf(
			'<p>%s</p>',
			sprintf(
				/* translators: 1: the shortcode of the search bar. 2: the title of the page that holds the booking engine. */
				esc_html__( 'Add the shortcode %1$s to the home page (in Elementor, the Shortcode widget): it sends the guest to the page %2$s with the dates and the guests.', 'casazen' ),
				'<code>[casazen_search]</code>',
				'<strong>' . esc_html( $name ) . '</strong>'
			)
		);
	}

	/**
	 * After the «Test connection» button: the result of the test.
	 *
	 * The query string only POINTS at the result: it carries the result code and nothing else, and it is not trusted. It
	 * stays in the address of the page after a save of the settings (the settings form sends the address of the page back to
	 * WordPress, and WordPress returns to it) and anyone can type it into a link. So the notice is printed only when its code
	 * is the code of the result that is stored for the saved address, and never right after a save: otherwise it could show
	 * a success that the saved address never had. The code is also checked against the known codes before it is printed.
	 *
	 * @return void
	 */
	private static function render_test_result() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- it only picks which message to show, nothing changes.
		if ( ! isset( $_GET['casazen_result'] ) ) {
			return;
		}
		// After a save the settings may have changed: the notice of an earlier test is not about them.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- same as above.
		if ( isset( $_GET['settings-updated'] ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- same as above.
		$code = sanitize_key( wp_unslash( $_GET['casazen_result'] ) );
		if ( ! in_array( $code, Connection::CODES, true ) ) {
			return;
		}
		// Nothing stored, or another outcome stored: the code of the address cannot be confirmed, so nothing is claimed.
		$stored = Connection::cached();
		if ( null === $stored || $stored['code'] !== $code ) {
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
