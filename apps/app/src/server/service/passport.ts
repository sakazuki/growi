import { IncomingMessage } from 'http';

import axiosRetry from 'axios-retry';
import luceneQueryParser from 'lucene-query-parser';
import { Strategy as OidcStrategy, Issuer as OIDCIssuer, custom } from 'openid-client';
import pRetry from 'p-retry';
import passport from 'passport';
import { Strategy as CognitoStrategy } from 'passport-cognito';
import { Strategy as GitHubStrategy } from 'passport-github';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import LdapStrategy from 'passport-ldapauth';
import { Strategy as LocalStrategy } from 'passport-local';
import { Profile, Strategy as SamlStrategy, VerifiedCallback } from 'passport-saml';
import urljoin from 'url-join';

import loggerFactory from '~/utils/logger';

import S2sMessage from '../models/vo/s2s-message';

import { S2sMessageHandlable } from './s2s-messaging/handlable';

const logger = loggerFactory('growi:service:PassportService');


interface IncomingMessageWithLdapAccountInfo extends IncomingMessage {
  ldapAccountInfo: any;
}

/**
 * the service class of Passport
 */
class PassportService implements S2sMessageHandlable {

  // see '/lib/form/login.js'
  static get USERNAME_FIELD() { return 'loginForm[username]' }

  static get PASSWORD_FIELD() { return 'loginForm[password]' }

  crowi!: any;

  lastLoadedAt?: Date;

  /**
   * the flag whether LocalStrategy is set up successfully
   */
  isLocalStrategySetup = false;

  /**
   * the flag whether LdapStrategy is set up successfully
   */
  isLdapStrategySetup = false;

  /**
   * the flag whether GoogleStrategy is set up successfully
   */
  isGoogleStrategySetup = false;

  /**
   * the flag whether GitHubStrategy is set up successfully
   */
  isGitHubStrategySetup = false;

  /**
   * the flag whether OidcStrategy is set up successfully
   */
  isOidcStrategySetup = false;

  /**
   * the flag whether SamlStrategy is set up successfully
   */
  isSamlStrategySetup = false;

  /**
   * the flag whether CognitoStrategy is set up successfully
   */
  isCognitoStrategySetup = false;

  /**
   * the flag whether serializer/deserializer are set up successfully
   */
  isSerializerSetup = false;

  /**
   * the keys of mandatory configs for SAML
   */
  mandatoryConfigKeysForSaml = [
    'security:passport-saml:entryPoint',
    'security:passport-saml:issuer',
    'security:passport-saml:cert',
    'security:passport-saml:attrMapId',
    'security:passport-saml:attrMapUsername',
    'security:passport-saml:attrMapMail',
  ];

  setupFunction = {
    local: {
      setup: 'setupLocalStrategy',
      reset: 'resetLocalStrategy',
    },
    ldap: {
      setup: 'setupLdapStrategy',
      reset: 'resetLdapStrategy',
    },
    saml: {
      setup: 'setupSamlStrategy',
      reset: 'resetSamlStrategy',
    },
    oidc: {
      setup: 'setupOidcStrategy',
      reset: 'resetOidcStrategy',
    },
    google: {
      setup: 'setupGoogleStrategy',
      reset: 'resetGoogleStrategy',
    },
    github: {
      setup: 'setupGitHubStrategy',
      reset: 'resetGitHubStrategy',
    },
    cognito: {
      setup: 'setupCognitoStrategy',
      reset: 'resetCognitoStrategy',
    },
  };

  constructor(crowi: any) {
    this.crowi = crowi;
  }


  /**
   * @inheritdoc
   */
  shouldHandleS2sMessage(s2sMessage) {
    const { eventName, updatedAt, strategyId } = s2sMessage;
    if (eventName !== 'passportServiceUpdated' || updatedAt == null || strategyId == null) {
      return false;
    }

    return this.lastLoadedAt == null || this.lastLoadedAt < new Date(s2sMessage.updatedAt);
  }

  /**
   * @inheritdoc
   */
  async handleS2sMessage(s2sMessage) {
    const { configManager } = this.crowi;
    const { strategyId } = s2sMessage;

    logger.info('Reset strategy by pubsub notification');
    await configManager.loadConfigs();
    return this.setupStrategyById(strategyId);
  }

  async publishUpdatedMessage(strategyId) {
    const { s2sMessagingService } = this.crowi;

    if (s2sMessagingService != null) {
      const s2sMessage = new S2sMessage('passportStrategyReloaded', {
        updatedAt: new Date(),
        strategyId,
      });

      try {
        await s2sMessagingService.publish(s2sMessage);
      }
      catch (e) {
        logger.error('Failed to publish update message with S2sMessagingService: ', e.message);
      }
    }
  }

  /**
   * get SetupStrategies
   *
   * @return {Array}
   * @memberof PassportService
   */
  getSetupStrategies() {
    const setupStrategies: string[] = [];

    if (this.isLocalStrategySetup) { setupStrategies.push('local') }
    if (this.isLdapStrategySetup) { setupStrategies.push('ldap') }
    if (this.isSamlStrategySetup) { setupStrategies.push('saml') }
    if (this.isOidcStrategySetup) { setupStrategies.push('oidc') }
    if (this.isGoogleStrategySetup) { setupStrategies.push('google') }
    if (this.isGitHubStrategySetup) { setupStrategies.push('github') }
    if (this.isCognitoStrategySetup) { setupStrategies.push('cognito') }

    return setupStrategies;
  }

  /**
   * get SetupFunction
   *
   * @return {Object}
   * @param {string} authId
   */
  getSetupFunction(authId) {
    return this.setupFunction[authId];
  }

  /**
   * setup strategy by target name
   */
  async setupStrategyById(authId) {
    const func = this.getSetupFunction(authId);

    try {
      this[func.setup]();
    }
    catch (err) {
      logger.debug(err);
      this[func.reset]();
    }

    this.lastLoadedAt = new Date();
  }

  /**
   * reset LocalStrategy
   *
   * @memberof PassportService
   */
  resetLocalStrategy() {
    logger.debug('LocalStrategy: reset');
    passport.unuse('local');
    this.isLocalStrategySetup = false;
  }

  /**
   * setup LocalStrategy
   *
   * @memberof PassportService
   */
  setupLocalStrategy() {

    this.resetLocalStrategy();

    const { configManager } = this.crowi;

    const isEnabled = configManager.getConfig('crowi', 'security:passport-local:isEnabled');

    // when disabled
    if (!isEnabled) {
      return;
    }

    logger.debug('LocalStrategy: setting up..');

    const User = this.crowi.model('User');

    passport.use(new LocalStrategy(
      {
        usernameField: PassportService.USERNAME_FIELD,
        passwordField: PassportService.PASSWORD_FIELD,
      },
      (username, password, done) => {
        // find user
        User.findUserByUsernameOrEmail(username, password, (err, user) => {
          if (err) { return done(err) }
          // check existence and password
          if (!user || !user.isPasswordValid(password)) {
            return done(null, false, { message: 'Incorrect credentials.' });
          }
          return done(null, user);
        });
      },
    ));

    this.isLocalStrategySetup = true;
    logger.debug('LocalStrategy: setup is done');
  }

  /**
   * reset LdapStrategy
   *
   * @memberof PassportService
   */
  resetLdapStrategy() {
    logger.debug('LdapStrategy: reset');
    passport.unuse('ldapauth');
    this.isLdapStrategySetup = false;
  }

  /**
   * Asynchronous configuration retrieval
   *
   * @memberof PassportService
   */
  setupLdapStrategy() {

    this.resetLdapStrategy();

    const config = this.crowi.config;
    const { configManager } = this.crowi;

    const isLdapEnabled = configManager.getConfig('crowi', 'security:passport-ldap:isEnabled');

    // when disabled
    if (!isLdapEnabled) {
      return;
    }

    logger.debug('LdapStrategy: setting up..');

    passport.use(new LdapStrategy(this.getLdapConfigurationFunc(config, { passReqToCallback: true }),
      (req, ldapAccountInfo, done) => {
        logger.debug('LDAP authentication has succeeded', ldapAccountInfo);

        // store ldapAccountInfo to req
        (req as IncomingMessageWithLdapAccountInfo).ldapAccountInfo = ldapAccountInfo;

        done(null, ldapAccountInfo);
      }));

    this.isLdapStrategySetup = true;
    logger.debug('LdapStrategy: setup is done');
  }

  /**
   * return attribute name for mapping to username of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getLdapAttrNameMappedToUsername() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-ldap:attrMapUsername') || 'uid';
  }

  /**
   * return attribute name for mapping to name of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getLdapAttrNameMappedToName() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-ldap:attrMapName') || '';
  }

  /**
   * return attribute name for mapping to name of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getLdapAttrNameMappedToMail() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-ldap:attrMapMail') || 'mail';
  }

  /**
   * CAUTION: this method is capable to use only when `req.body.loginForm` is not null
   *
   * @param {any} req
   * @returns
   * @memberof PassportService
   */
  getLdapAccountIdFromReq(req) {
    return req.body.loginForm.username;
  }

  /**
   * Asynchronous configuration retrieval
   * @see https://github.com/vesse/passport-ldapauth#asynchronous-configuration-retrieval
   *
   * @param {object} config
   * @param {object} opts
   * @returns
   * @memberof PassportService
   */
  getLdapConfigurationFunc(config, opts) {
    /* eslint-disable no-multi-spaces */
    const { configManager } = this.crowi;

    // get configurations
    const isUserBind        = configManager.getConfig('crowi', 'security:passport-ldap:isUserBind');
    const serverUrl         = configManager.getConfig('crowi', 'security:passport-ldap:serverUrl');
    const bindDN            = configManager.getConfig('crowi', 'security:passport-ldap:bindDN');
    const bindCredentials   = configManager.getConfig('crowi', 'security:passport-ldap:bindDNPassword');
    const searchFilter      = configManager.getConfig('crowi', 'security:passport-ldap:searchFilter') || '(uid={{username}})';
    const groupSearchBase   = configManager.getConfig('crowi', 'security:passport-ldap:groupSearchBase');
    const groupSearchFilter = configManager.getConfig('crowi', 'security:passport-ldap:groupSearchFilter');
    const groupDnProperty   = configManager.getConfig('crowi', 'security:passport-ldap:groupDnProperty') || 'uid';
    /* eslint-enable no-multi-spaces */

    // parse serverUrl
    // see: https://regex101.com/r/0tuYBB/1
    const match = serverUrl.match(/(ldaps?:\/\/[^/]+)\/(.*)?/);
    if (match == null || match.length < 1) {
      logger.debug('LdapStrategy: serverUrl is invalid');
      return (req, callback) => { callback({ message: 'serverUrl is invalid' }) };
    }
    const url = match[1];
    const searchBase = match[2] || '';

    logger.debug(`LdapStrategy: url=${url}`);
    logger.debug(`LdapStrategy: searchBase=${searchBase}`);
    logger.debug(`LdapStrategy: isUserBind=${isUserBind}`);
    if (!isUserBind) {
      logger.debug(`LdapStrategy: bindDN=${bindDN}`);
      logger.debug(`LdapStrategy: bindCredentials=${bindCredentials}`);
    }
    logger.debug(`LdapStrategy: searchFilter=${searchFilter}`);
    logger.debug(`LdapStrategy: groupSearchBase=${groupSearchBase}`);
    logger.debug(`LdapStrategy: groupSearchFilter=${groupSearchFilter}`);
    logger.debug(`LdapStrategy: groupDnProperty=${groupDnProperty}`);

    return (req, callback) => {
      // get credentials from form data
      const loginForm = req.body.loginForm;
      if (!req.form.isValid) {
        return callback({ message: 'Incorrect credentials.' });
      }

      // user bind
      const fixedBindDN = (isUserBind)
        ? bindDN.replace(/{{username}}/, loginForm.username)
        : bindDN;
      const fixedBindCredentials = (isUserBind) ? loginForm.password : bindCredentials;
      let serverOpt = {
        url,
        bindDN: fixedBindDN,
        bindCredentials: fixedBindCredentials,
        searchBase,
        searchFilter,
        attrMapUsername: this.getLdapAttrNameMappedToUsername(),
        attrMapName: this.getLdapAttrNameMappedToName(),
      };

      if (groupSearchBase && groupSearchFilter) {
        serverOpt = Object.assign(serverOpt, { groupSearchBase, groupSearchFilter, groupDnProperty });
      }

      process.nextTick(() => {
        const mergedOpts = Object.assign({
          usernameField: PassportService.USERNAME_FIELD,
          passwordField: PassportService.PASSWORD_FIELD,
          server: serverOpt,
        }, opts);
        logger.debug('ldap configuration: ', mergedOpts);

        // store configuration to req
        req.ldapConfiguration = mergedOpts;

        callback(null, mergedOpts);
      });
    };
  }

  /**
   * Asynchronous configuration retrieval
   *
   * @memberof PassportService
   */
  setupGoogleStrategy() {

    this.resetGoogleStrategy();

    const { configManager } = this.crowi;
    const isGoogleEnabled = configManager.getConfig('crowi', 'security:passport-google:isEnabled');

    // when disabled
    if (!isGoogleEnabled) {
      return;
    }

    logger.debug('GoogleStrategy: setting up..');
    passport.use(
      new GoogleStrategy(
        {
          clientID: configManager.getConfig('crowi', 'security:passport-google:clientId'),
          clientSecret: configManager.getConfig('crowi', 'security:passport-google:clientSecret'),
          callbackURL: (this.crowi.appService.getSiteUrl() != null)
            ? urljoin(this.crowi.appService.getSiteUrl(), '/passport/google/callback') // auto-generated with v3.2.4 and above
            : configManager.getConfig('crowi', 'security:passport-google:callbackUrl'), // DEPRECATED: backward compatible with v3.2.3 and below
          skipUserProfile: false,
        },
        (accessToken, refreshToken, profile, done) => {
          if (profile) {
            return done(null, profile);
          }

          return done(null, false);
        },
      ),
    );

    this.isGoogleStrategySetup = true;
    logger.debug('GoogleStrategy: setup is done');
  }

  /**
   * reset GoogleStrategy
   *
   * @memberof PassportService
   */
  resetGoogleStrategy() {
    logger.debug('GoogleStrategy: reset');
    passport.unuse('google');
    this.isGoogleStrategySetup = false;
  }

  setupGitHubStrategy() {

    this.resetGitHubStrategy();

    const { configManager } = this.crowi;
    const isGitHubEnabled = configManager.getConfig('crowi', 'security:passport-github:isEnabled');

    // when disabled
    if (!isGitHubEnabled) {
      return;
    }

    logger.debug('GitHubStrategy: setting up..');
    passport.use(
      new GitHubStrategy(
        {
          clientID: configManager.getConfig('crowi', 'security:passport-github:clientId'),
          clientSecret: configManager.getConfig('crowi', 'security:passport-github:clientSecret'),
          callbackURL: (this.crowi.appService.getSiteUrl() != null)
            ? urljoin(this.crowi.appService.getSiteUrl(), '/passport/github/callback') // auto-generated with v3.2.4 and above
            : configManager.getConfig('crowi', 'security:passport-github:callbackUrl'), // DEPRECATED: backward compatible with v3.2.3 and below
          skipUserProfile: false,
        },
        (accessToken, refreshToken, profile, done) => {
          if (profile) {
            return done(null, profile);
          }

          return done(null, false);
        },
      ),
    );

    this.isGitHubStrategySetup = true;
    logger.debug('GitHubStrategy: setup is done');
  }

  /**
   * reset GitHubStrategy
   *
   * @memberof PassportService
   */
  resetGitHubStrategy() {
    logger.debug('GitHubStrategy: reset');
    passport.unuse('github');
    this.isGitHubStrategySetup = false;
  }

  async setupOidcStrategy() {

    this.resetOidcStrategy();

    const { configManager } = this.crowi;
    const isOidcEnabled = configManager.getConfig('crowi', 'security:passport-oidc:isEnabled');

    // when disabled
    if (!isOidcEnabled) {
      return;
    }

    logger.debug('OidcStrategy: setting up..');

    // setup client
    // extend oidc request timeouts
    const OIDC_ISSUER_TIMEOUT_OPTION = await this.crowi.configManager.getConfig('crowi', 'security:passport-oidc:oidcIssuerTimeoutOption');
    // OIDCIssuer.defaultHttpOptions = { timeout: OIDC_ISSUER_TIMEOUT_OPTION };

    custom.setHttpOptionsDefaults({
      timeout: OIDC_ISSUER_TIMEOUT_OPTION,
    });

    const issuerHost = configManager.getConfig('crowi', 'security:passport-oidc:issuerHost');
    const clientId = configManager.getConfig('crowi', 'security:passport-oidc:clientId');
    const clientSecret = configManager.getConfig('crowi', 'security:passport-oidc:clientSecret');
    const redirectUri = (configManager.getConfig('crowi', 'app:siteUrl') != null)
      ? urljoin(this.crowi.appService.getSiteUrl(), '/passport/oidc/callback')
      : configManager.getConfig('crowi', 'security:passport-oidc:callbackUrl'); // DEPRECATED: backward compatible with v3.2.3 and below

    // Prevent request timeout error on app init
    const oidcIssuer = await this.getOIDCIssuerInstance(issuerHost);
    if (oidcIssuer != null) {
      logger.debug('Discovered issuer %s %O', oidcIssuer.issuer, oidcIssuer.metadata);

      const authorizationEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:authorizationEndpoint');
      if (authorizationEndpoint) {
        oidcIssuer.metadata.authorization_endpoint = authorizationEndpoint;
      }
      const tokenEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:tokenEndpoint');
      if (tokenEndpoint) {
        oidcIssuer.metadata.token_endpoint = tokenEndpoint;
      }
      const revocationEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:revocationEndpoint');
      if (revocationEndpoint) {
        oidcIssuer.metadata.revocation_endpoint = revocationEndpoint;
      }
      const introspectionEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:introspectionEndpoint');
      if (introspectionEndpoint) {
        oidcIssuer.metadata.introspection_endpoint = introspectionEndpoint;
      }
      const userInfoEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:userInfoEndpoint');
      if (userInfoEndpoint) {
        oidcIssuer.metadata.userinfo_endpoint = userInfoEndpoint;
      }
      const endSessionEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:endSessionEndpoint');
      if (endSessionEndpoint) {
        oidcIssuer.metadata.end_session_endpoint = endSessionEndpoint;
      }
      const registrationEndpoint = configManager.getConfig('crowi', 'security:passport-oidc:registrationEndpoint');
      if (registrationEndpoint) {
        oidcIssuer.metadata.registration_endpoint = registrationEndpoint;
      }
      const jwksUri = configManager.getConfig('crowi', 'security:passport-oidc:jwksUri');
      if (jwksUri) {
        oidcIssuer.metadata.jwks_uri = jwksUri;
      }
      logger.debug('Configured issuer %s %O', oidcIssuer.issuer, oidcIssuer.metadata);

      const client = new oidcIssuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [redirectUri],
        response_types: ['code'],
      });
      // prevent error AssertionError [ERR_ASSERTION]: id_token issued in the future
      // Doc: https://github.com/panva/node-openid-client/tree/v2.x#allow-for-system-clock-skew
      const OIDC_CLIENT_CLOCK_TOLERANCE = await this.crowi.configManager.getConfig('crowi', 'security:passport-oidc:oidcClientClockTolerance');
      client[custom.clock_tolerance] = OIDC_CLIENT_CLOCK_TOLERANCE;
      passport.use('oidc', new OidcStrategy(
        {
          client,
          params: { scope: 'openid email profile' },
        },
        (tokenset, userinfo, done) => {
          if (userinfo) {
            return done(null, userinfo);
          }

          return done(null, false);
        },
      ));

      this.isOidcStrategySetup = true;
      logger.debug('OidcStrategy: setup is done');
    }

  }

  /**
   * reset OidcStrategy
   *
   * @memberof PassportService
   */
  resetOidcStrategy() {
    logger.debug('OidcStrategy: reset');
    passport.unuse('oidc');
    this.isOidcStrategySetup = false;
  }

  /**
   * Sanitize issuer Host / URL to match specified format
   * Acceptable formats :
   * - https://hostname.com/auth/
   * - domain only (hostname.com)
   * - Full metadata url (https://hostname.com/auth/v2/.well-known/openid-configuration)
   * @param issuerHost string
   * @returns string URL/.well-known/openid-configuration
   */
  getOIDCMetadataURL(issuerHost: string) : string {
    const protocol = 'https://';
    const pattern = /^https?:\/\//i;
    const metadataPath = '/.well-known/openid-configuration';
    // If URL is full path with .well-known/openid-configuration
    if (issuerHost.endsWith(metadataPath)) {
      return issuerHost;
    }
    // Set protocol if not available on url
    const absUrl = !pattern.test(issuerHost) ? `${protocol}${issuerHost}` : issuerHost;
    const url = new URL(absUrl).href;
    // Remove trailing slash if exists
    return `${url.replace(/\/+$/, '')}${metadataPath}`;
  }

  /**
 *
 * Check and initialize connection to OIDC issuer host
 * Prevent request timeout error on app init
 *
 * @param issuerHost string
 * @returns boolean
 */
  async isOidcHostReachable(issuerHost: string): Promise<boolean | undefined> {
    try {
      const metadataUrl = this.getOIDCMetadataURL(issuerHost);
      const client = require('axios').default;
      axiosRetry(client, {
        retries: 3,
      });
      const response = await client.get(metadataUrl);
      // Check for valid OIDC Issuer configuration
      if (!response.data.issuer) {
        logger.debug('OidcStrategy: Invalid OIDC Issuer configurations');
        return false;
      }
      return true;
    }
    catch (err) {
      logger.error('OidcStrategy: issuer host unreachable:', err.code);
    }
  }

  /**
   * Get oidcIssuer object
   * Utilize p-retry package to retry oidcIssuer initialization 3 times
   *
   * @param issuerHost string
   * @returns instance of OIDCIssuer
   */
  async getOIDCIssuerInstance(issuerHost: string): Promise<void | OIDCIssuer> {
    const OIDC_TIMEOUT_MULTIPLIER = await this.crowi.configManager.getConfig('crowi', 'security:passport-oidc:timeoutMultiplier');
    const OIDC_DISCOVERY_RETRIES = await this.crowi.configManager.getConfig('crowi', 'security:passport-oidc:discoveryRetries');
    const OIDC_ISSUER_TIMEOUT_OPTION = await this.crowi.configManager.getConfig('crowi', 'security:passport-oidc:oidcIssuerTimeoutOption');
    const oidcIssuerHostReady = await this.isOidcHostReachable(issuerHost);
    if (!oidcIssuerHostReady) {
      logger.error('OidcStrategy: setup failed');
      return;
    }
    const metadataURL = this.getOIDCMetadataURL(issuerHost);
    const oidcIssuer = await pRetry(async() => {
      return OIDCIssuer.discover(metadataURL);
    }, {
      onFailedAttempt: (error) => {
        // get current OIDCIssuer timeout options
        OIDCIssuer[custom.http_options] = (url, options) => {
          const timeout = options.timeout
            ? options.timeout * OIDC_TIMEOUT_MULTIPLIER
            : OIDC_ISSUER_TIMEOUT_OPTION * OIDC_TIMEOUT_MULTIPLIER;
          custom.setHttpOptionsDefaults({ timeout });
          return { timeout };
        };

        logger.debug(`OidcStrategy: setup attempt ${error.attemptNumber} failed with error: ${error}. Retrying ...`);
      },
      retries: OIDC_DISCOVERY_RETRIES,
    }).catch((error) => {
      logger.error(`OidcStrategy: setup failed with error: ${error} `);
    });
    return oidcIssuer;
  }

  setupSamlStrategy() {

    this.resetSamlStrategy();

    const { configManager } = this.crowi;
    const isSamlEnabled = configManager.getConfig('crowi', 'security:passport-saml:isEnabled');

    // when disabled
    if (!isSamlEnabled) {
      return;
    }

    logger.debug('SamlStrategy: setting up..');
    passport.use(
      new SamlStrategy(
        {
          entryPoint: configManager.getConfig('crowi', 'security:passport-saml:entryPoint'),
          callbackUrl: (this.crowi.appService.getSiteUrl() != null)
            ? urljoin(this.crowi.appService.getSiteUrl(), '/passport/saml/callback') // auto-generated with v3.2.4 and above
            : configManager.getConfig('crowi', 'security:passport-saml:callbackUrl'), // DEPRECATED: backward compatible with v3.2.3 and below
          issuer: configManager.getConfig('crowi', 'security:passport-saml:issuer'),
          cert: configManager.getConfig('crowi', 'security:passport-saml:cert'),
        },
        (profile: Profile, done: VerifiedCallback) => {
          if (profile) {
            return done(null, profile);
          }

          return done(null);
        },
      ),
    );

    this.isSamlStrategySetup = true;
    logger.debug('SamlStrategy: setup is done');
  }

  /**
   * reset SamlStrategy
   *
   * @memberof PassportService
   */
  resetSamlStrategy() {
    logger.debug('SamlStrategy: reset');
    passport.unuse('saml');
    this.isSamlStrategySetup = false;
  }

  /**
   * return the keys of the configs mandatory for SAML whose value are empty.
   */
  getSamlMissingMandatoryConfigKeys() {
    const missingRequireds: string[] = [];
    for (const key of this.mandatoryConfigKeysForSaml) {
      if (this.crowi.configManager.getConfig('crowi', key) === null) {
        missingRequireds.push(key);
      }
    }
    return missingRequireds;
  }

  /**
   * reset CognitoStrategy
   *
   * @memberof PassportService
   */

  resetCognitoStrategy() {
    logger.debug('CognitoStrategy: reset');
    passport.unuse('cognito');
    this.isCognitoStrategySetup = false;
  }

  /**
   * setup CognitoStrategy
   *
   * @memberof PassportService
   */
  setupCognitoStrategy() {
    this.resetCognitoStrategy();

    const { configManager } = this.crowi;
    const isCognitoEnabled = configManager.getConfig('crowi', 'security:passport-cognito:isEnabled');

    // when disabled
    if (!isCognitoEnabled) {
      return;
    }

    logger.debug('CognitoStrategy: setting up..');
    passport.use(
      new CognitoStrategy(
        {
          userPoolId: configManager.getConfig('crowi', 'security:passport-cognito:userPoolId'),
          clientId: configManager.getConfig('crowi', 'security:passport-cognito:clientId'),
          region: configManager.getConfig('crowi', 'security:passport-cognito:region'),
        },
        (accessToken, idToken, refreshToken, profile, done) => {
          logger.debug(accessToken, idToken, refreshToken, profile, done);
          if (profile) {
            return done(null, profile);
          }

          return done(null, false);
        },
      ),
    );

    this.isCognitoStrategySetup = true;
    logger.debug('CognitoStrategy: setup is done');
  }

  /**
   * return attribute name for mapping to username of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getCognitoAttrNameMappedToUsername() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-cognito:attrMapUsername') || 'username';
  }

  /**
   * return attribute name for mapping to name of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getCognitoAttrNameMappedToName() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-cognito:attrMapName') || 'name';
  }

  /**
   * return attribute name for mapping to name of Crowi DB
   *
   * @returns
   * @memberof PassportService
   */
  getCognitoAttrNameMappedToMail() {
    return this.crowi.configManager.getConfig('crowi', 'security:passport-cognito:attrMapMail') || 'email';
  }

  /**
   * Parse Attribute-Based Login Control Rule as Lucene Query
   * @param {string} rule Lucene syntax string
   * @returns {object} Expression Tree Structure generated by lucene-query-parser
   * @see https://github.com/thoward/lucene-query-parser.js/wiki
   */
  parseABLCRule(rule) {
    // parse with lucene-query-parser
    // see https://github.com/thoward/lucene-query-parser.js/wiki
    return luceneQueryParser.parse(rule);
  }

  /**
   * Verify that a SAML response meets the attribute-base login control rule
   */
  verifySAMLResponseByABLCRule(response) {
    const rule = this.crowi.configManager.getConfig('crowi', 'security:passport-saml:ABLCRule');
    if (rule == null) {
      logger.debug('There is no ABLCRule.');
      return true;
    }

    const luceneRule = this.parseABLCRule(rule);
    logger.debug({ 'Parsed Rule': JSON.stringify(luceneRule, null, 2) });

    const attributes = this.extractAttributesFromSAMLResponse(response);
    logger.debug({ 'Extracted Attributes': JSON.stringify(attributes, null, 2) });

    return this.evaluateRuleForSamlAttributes(attributes, luceneRule);
  }

  /**
   * Evaluate whether the specified rule is satisfied under the specified attributes
   *
   * @param {object} attributes results by extractAttributesFromSAMLResponse
   * @param {object} luceneRule Expression Tree Structure generated by lucene-query-parser
   * @see https://github.com/thoward/lucene-query-parser.js/wiki
   */
  evaluateRuleForSamlAttributes(attributes, luceneRule) {
    const { left, right, operator } = luceneRule;

    // when combined rules
    if (right != null) {
      return this.evaluateCombinedRulesForSamlAttributes(attributes, left, right, operator);
    }
    if (left != null) {
      return this.evaluateRuleForSamlAttributes(attributes, left);
    }

    const { field, term } = luceneRule;
    const unescapedField = this.literalUnescape(field);
    if (unescapedField === '<implicit>') {
      return attributes[term] != null;
    }

    if (attributes[unescapedField] == null) {
      return false;
    }

    return attributes[unescapedField].includes(term);
  }

  /**
   * Evaluate whether the specified two rules are satisfied under the specified attributes
   *
   * @param {object} attributes results by extractAttributesFromSAMLResponse
   * @param {object} luceneRuleLeft Expression Tree Structure generated by lucene-query-parser
   * @param {object} luceneRuleRight Expression Tree Structure generated by lucene-query-parser
   * @param {string} luceneOperator operator string expression
   * @see https://github.com/thoward/lucene-query-parser.js/wiki
   */
  evaluateCombinedRulesForSamlAttributes(attributes, luceneRuleLeft, luceneRuleRight, luceneOperator) {
    if (luceneOperator === 'OR') {
      return this.evaluateRuleForSamlAttributes(attributes, luceneRuleLeft) || this.evaluateRuleForSamlAttributes(attributes, luceneRuleRight);
    }
    if (luceneOperator === 'AND') {
      return this.evaluateRuleForSamlAttributes(attributes, luceneRuleLeft) && this.evaluateRuleForSamlAttributes(attributes, luceneRuleRight);
    }
    if (luceneOperator === 'NOT') {
      return this.evaluateRuleForSamlAttributes(attributes, luceneRuleLeft) && !this.evaluateRuleForSamlAttributes(attributes, luceneRuleRight);
    }

    throw new Error(`Unsupported operator: ${luceneOperator}`);
  }

  /**
   * Extract attributes from a SAML response
   *
   * The format of extracted attributes is the following.
   *
   * {
   *    "attribute_name1": ["value1", "value2", ...],
   *    "attribute_name2": ["value1", "value2", ...],
   *    ...
   * }
   */
  extractAttributesFromSAMLResponse(response) {
    const attributeStatement = response.getAssertion().Assertion.AttributeStatement;
    if (attributeStatement == null || attributeStatement[0] == null) {
      return {};
    }

    const attributes = attributeStatement[0].Attribute;
    if (attributes == null) {
      return {};
    }

    const result = {};
    for (const attribute of attributes) {
      const name = attribute.$.Name;
      const attributeValues = attribute.AttributeValue.map(v => v._);
      if (result[name] == null) {
        result[name] = attributeValues;
      }
      else {
        result[name] = result[name].concat(attributeValues);
      }
    }

    return result;
  }

  /**
   * setup serializer and deserializer
   *
   * @memberof PassportService
   */
  setupSerializer() {
    // check whether the serializer/deserializer have already been set up
    if (this.isSerializerSetup) {
      throw new Error('serializer/deserializer have already been set up');
    }

    logger.debug('setting up serializer and deserializer');

    const User = this.crowi.model('User');

    passport.serializeUser((user, done) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      done(null, (user as any).id);
    });
    passport.deserializeUser(async(id, done) => {
      try {
        const user = await User.findById(id);
        if (user == null) {
          throw new Error('user not found');
        }
        if (user.imageUrlCached == null) {
          await user.updateImageUrlCached();
          await user.save();
        }
        done(null, user);
      }
      catch (err) {
        done(err);
      }
    });

    this.isSerializerSetup = true;
  }

  isSameUsernameTreatedAsIdenticalUser(providerType) {
    const key = `security:passport-${providerType}:isSameUsernameTreatedAsIdenticalUser`;
    return this.crowi.configManager.getConfig('crowi', key);
  }

  isSameEmailTreatedAsIdenticalUser(providerType) {
    const key = `security:passport-${providerType}:isSameEmailTreatedAsIdenticalUser`;
    return this.crowi.configManager.getConfig('crowi', key);
  }

  literalUnescape(string: string) {
    return string
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/')
      .replace(/\\:/g, ':')
      .replace(/\\"/g, '"')
      .replace(/\\0/g, '\0')
      .replace(/\\t/g, '\t')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');
  }

}

module.exports = PassportService;
