=== CasaZen ===
Contributors: casazen
Tags: booking, vacation rental, reservations, availability, short-term rental
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connects your WordPress site to CasaZen, so that your booking engine and your guest area appear on your own pages.

== Description ==

CasaZen is the management software of holiday-rental agencies. This plugin connects your WordPress site to the address that your agency uses with CasaZen, so that the booking engine and the guest area can appear on your own pages.

The PHP of the plugin is thin on purpose: the behaviour of the widgets lives in a small script that CasaZen serves from your own address, so a change of the widgets never needs a plugin update.

This version provides:

* one button, "Connect to CasaZen": the CasaZen console opens, you confirm, and the site is connected to the account of your agency with a credential of its own (revocable); the address of your booking site and the organisation slug fill in by themselves;
* the domain of your booking site managed from the plugin, once connected: write the domain, copy the DNS records to create, follow its state (it refreshes by itself) and choose what runs on it (guest area, owner portal, links in the e-mails); once it is active the plugin uses it by itself;
* a settings page (Settings, then CasaZen) where, under Advanced, you can also set the address of your CasaZen booking site and the organisation slug by hand, plus a language mapping and a switch for the script;
* a connection test that tells you which agency answers at that address and whether embedding is switched on for it;
* five blocks and five shortcodes, with the same attributes and the same result: the booking engine (`[casazen_booking]`), one property (`[casazen_property slug="villa-rossa"]`), the search bar for the hero of your home page (`[casazen_search]`), the guest access (`[casazen_guest_access]`) and a link to the owner area (`[casazen_owner_login]`);
* the loader script of CasaZen, put in the page once and only on the pages that have a widget;
* a guided setup (Settings, then CasaZen, then Guided setup) that creates the pages "Book", "Online check-in" and "Owner area" with their menu entries, and never changes, moves or deletes anything that already exists;
* the language of Polylang and WPML for the widgets, and a static placeholder instead of the widget in the Elementor editor (the widgets work in Elementor through its Shortcode widget);
* texts in English and Italian;
* a clean uninstall: it gives the credential of the site back to CasaZen, removes the connection, the settings, the cached results and the scheduled events, and leaves your pages alone.

The payment of a booking never happens inside a frame: the booking engine takes the guest to the checkout page of your CasaZen address.

== Installation ==

The plugin is not on WordPress.org yet: install the ZIP.

1. Download the ZIP from the CasaZen console (Embed in your site, Download the plugin), or `casazen-<version>.zip` from a release of the plugin (the release tag is `wp-plugin-v<version>`, on https://github.com/casazen/frontend/releases).
2. In WordPress open Plugins, Add New, Upload Plugin, choose the ZIP, press Install Now, then Activate.
3. Open Settings, then CasaZen, and press Connect to CasaZen. In the CasaZen console (sign in if needed) check the address of the site and confirm. Back in WordPress the screen says "Connected to" and the name of your agency: the address and the slug are filled in and the connection test has run. Without connecting, you can enter the address of your CasaZen booking site (for example https://prenota.example.com) under Advanced and press Test connection.
4. Open the tab Guided setup and press Create the pages. It creates the pages for the booking engine, the online check-in and the owner area, and adds them to a menu that you choose. Or add the block CasaZen booking (or the shortcode `[casazen_booking]`) to a page yourself.
5. To use a domain of your own, write it in the section Domain of the settings page and create the two DNS records it shows where your domain is managed. The state refreshes by itself; once the domain is active the plugin uses it.
6. To put the search bar in the hero of your home page, add the shortcode `[casazen_search]` (in Elementor, with the Shortcode widget).

For a test install with a ZIP that carries no console address, define `CASAZEN_APP_ORIGIN` in wp-config.php (for example `define( 'CASAZEN_APP_ORIGIN', 'https://casazen-test-app.vercel.app' );`): Connect to CasaZen then opens that console.

The long guide (every shortcode attribute, the language mapping for Polylang and WPML, Elementor, cache plugins, privacy and troubleshooting) is the README of the plugin, in Italian and in English: https://github.com/casazen/frontend/tree/develop/integrations/wordpress/casazen

== Frequently Asked Questions ==

= Do I need a CasaZen account? =

Yes. The plugin only shows what your agency publishes with CasaZen. While no address is set in the settings the plugin does nothing.

= Does the plugin send data about my visitors to CasaZen? =

No. When a visitor opens a page of your site, your server does not call CasaZen. The widgets are loaded by the browser of the visitor from your CasaZen address, like any other embedded content.

= What do I need on the CasaZen side? =

The account of your agency with embedding switched on, and an administrator of the agency to press Connect to CasaZen. A domain of your own (for example prenota.example.com) needs the Pro plan; without it the booking site answers on the CasaZen address. Until embedding is on, the plugin shows nothing to your visitors, and the administrators of the site see a note.

= What does Connect to CasaZen store? =

A credential of the site, made by the button and revocable, in the WordPress database (the option casazen_link, not autoloaded). Only the admin screens of the plugin use it, from the server, and it never appears in a page. Disconnect gives it back to CasaZen; the CasaZen console lists the connected sites and can disconnect them too. If CasaZen no longer accepts it, the screen says "No longer connected" and your settings stay.

= Which versions of WordPress and PHP does it need? =

WordPress 6.4 or later and PHP 7.4 or later.

= Nothing appears on my page. What do I check? =

Open Settings, then CasaZen, and press Test connection: it tells you if the address is wrong, if CasaZen does not know it, or if embedding is not on yet. If the test is fine and the page is still empty, a cache or optimisation plugin is probably delaying or combining the script: exclude every address that contains /embed/v1/ from its JavaScript options and clear the cache. The README lists the other causes.

= Does it work with Elementor, Polylang and WPML? =

Yes. In Elementor use the Shortcode widget (the editor shows a placeholder, the published page shows the widget). With Polylang or WPML the widgets follow the language of the page: the language mapping in the settings says how the code of a language becomes it, en or auto.

= Is the payment made inside the page? =

No. When a guest chooses to book, the whole page goes to the checkout of your CasaZen address. Payment, sign-in and the owner portal are never inside a frame.

= What does uninstalling remove? =

It gives the credential of a connected site back to CasaZen (if CasaZen does not answer within 10 seconds the uninstall goes on), then removes the connection, the settings, the cached results and the scheduled events of the plugin. The pages created by the Guided setup, and their menu entries, are your content: they stay.

== Changelog ==

= 0.2.0 =
* Connect to CasaZen: one button connects the site to the account of the agency and fills in the address and the slug.
* The domain of the booking site managed from the plugin: DNS records with copy buttons, a state that refreshes by itself, Check now, Remove domain and the choices of what runs on the domain.
* The manual set-up moves under Advanced. Disconnect, and the uninstall gives the credential back.

= 0.1.0 =
* First version: settings page, connection test with a 12 hour cache, shortcodes and blocks for the widgets, English and Italian texts, clean uninstall.

== External services ==

This plugin connects to the CasaZen service of your agency, at the address that you enter in the settings (for example https://prenota.example.com).

* What the service is and what it is used for: CasaZen is the booking software of your agency. The plugin asks it which agency answers at your address and whether embedding is switched on, and the browser of your visitors loads the booking widgets from it.
* What is sent, and when: the server of your site requests `<address>/embed/v1/manifest.json` and the CasaZen API named in that file: `/api/public/resolve-host` and, only when you have entered an organisation slug in the settings and CasaZen does not know the host name of your address (your address is the CasaZen domain), `/api/public/orgs/<slug>`; then, to fill the "Where" field of the search bar, `/api/public/orgs/<slug>/destinations` (the places of your properties, with the slug that CasaZen gave for your address or the one you entered). It does so only from the settings screen (when you save the address and when you press Test connection) and from background events that renew the results after 12 hours. The only data sent is the host name of your address and the organisation slug, each inside the address of the request, and the name and version of the plugin as the user agent. No cookie, no personal data and no data about your visitors is sent, and a page that a visitor opens never starts these requests.
* Connected site (only after you press Connect to CasaZen): from the admin screens of the plugin and at the uninstall, never for a visitor, the server of your site requests the manifest of the CasaZen console (`<console>/embed/v1/manifest.json`, the console of the ZIP, of the constant CASAZEN_APP_ORIGIN or https://www.casazen.space), exchanges the one-time code of the connection (`/api/public/site-connections/token`: the code, the PKCE verifier and the address of your site) and then calls, with the credential of the site in the Authorization header, `/api/site/v1/account`, `/api/site/v1/domain`, `/api/site/v1/domain/verify`, `/api/site/v1/domain/surfaces` and `/api/site/v1/connection` (to disconnect). What is sent: the domain you write and your three choices for it. Always https, no redirects, 10 seconds at most.
* The browser of your visitors loads the script and the frames of the widgets from your CasaZen address (`<address>/embed/v1/embed.js`).
* Privacy notice: `<address>/legale/privacy`, for example https://prenota.example.com/legale/privacy.
