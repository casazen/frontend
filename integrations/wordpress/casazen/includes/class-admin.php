<?php
/**
 * The settings screen: Settings, then CasaZen.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Admin side of the plugin: the settings page with its two tabs («Settings» and «Guided setup»), its status box and the «Test
 * connection» button.
 *
 * Every action checks the capability and a nonce, every output is escaped where it is printed, and there is no field for a
 * secret (phase 1 has no API key).
 */
class Admin {

	/**
	 * The capability needed to see the screen and to use its forms.
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
	 * The first tab: the result of the last test, the status, the settings form and the «Test connection» form.
	 *
	 * @return void
	 */
	private static function render_settings_tab() {
		self::render_test_result();
		self::render_status();
		?>
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
		<?php
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

		$labels = self::role_labels();
		$items  = ( isset( $result['menu']['items'] ) && is_array( $result['menu']['items'] ) ) ? $result['menu']['items'] : array();

		echo '<div class="notice notice-success inline" id="casazen-wizard-result">';
		echo '<p><strong>' . esc_html__( 'The setup is done.', 'casazen' ) . '</strong></p><ul>';
		foreach ( Pages::roles() as $role ) {
			if ( ! isset( $result['pages'][ $role ] ) || ! is_array( $result['pages'][ $role ] ) ) {
				continue;
			}
			echo '<li>' . self::wizard_page_line( $labels[ $role ], $result['pages'][ $role ], isset( $items[ $role ] ) ? (string) $items[ $role ] : '' ) . '</li>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped piece by piece in wizard_page_line().
		}
		echo '</ul>';

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
