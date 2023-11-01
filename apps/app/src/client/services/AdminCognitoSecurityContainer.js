import { isServer } from '@growi/core/dist/utils';
import { Container } from 'unstated';

import loggerFactory from '~/utils/logger';
import { removeNullPropertyFromObject } from '~/utils/object-utils';

import { apiv3Get, apiv3Put } from '../util/apiv3-client';

const logger = loggerFactory('growi:security:AdminCognitoSecurityContainer');

/**
 * Service container for admin security page (CognitoSecurityManagement.jsx)
 * @extends {Container} unstated Container
 */
export default class AdminCognitoSecurityContainer extends Container {

  constructor(appContainer) {
    super();

    if (isServer()) {
      return;
    }

    this.dummyCognitoClientId = 0;
    this.dummyCognitoClientIdForError = 1;

    this.state = {
      retrieveError: null,
      // set dummy value tile for using suspense
      cognitoClientId: this.dummyCognitoClientId,
      cognitoUserPoolId: '',
      cognitoRegion: '',
      isSameUsernameTreatedAsIdenticalUser: false,
    };

  }

  /**
   * retrieve security data
   */
  async retrieveSecurityData() {
    try {
      const response = await apiv3Get('/security-setting/');
      const { cognitoAuth } = response.data.securityParams;
      this.setState({
        cognitoClientId: cognitoAuth.cognitoClientId,
        cognitoUserPoolId: cognitoAuth.cognitoUserPoolId,
        cognitoRegion: cognitoAuth.cognitoRegion,
        isSameUsernameTreatedAsIdenticalUser: cognitoAuth.isSameUsernameTreatedAsIdenticalUser,
      });
    }
    catch (err) {
      this.setState({ retrieveError: err });
      logger.error(err);
      throw new Error('Failed to fetch data');
    }
  }

  /**
   * Workaround for the mangling in production build to break constructor.name
   */
  static getClassName() {
    return 'AdminCognitoSecurityContainer';
  }

  /**
   * Change cognitoClientId
   */
  changeCognitoClientId(value) {
    this.setState({ cognitoClientId: value });
  }

  /**
   * Change cognitoUserPoolId
   */
  changeCognitoUserPoolId(value) {
    this.setState({ cognitoUserPoolId: value });
  }

  /**
   * Change cognitoRegion
   */
  changeCognitoRegion(value) {
    this.setState({ cognitoRegion: value });
  }

  /**
   * Switch isSameUsernameTreatedAsIdenticalUser
   */
  switchIsSameUsernameTreatedAsIdenticalUser() {
    this.setState({ isSameUsernameTreatedAsIdenticalUser: !this.state.isSameUsernameTreatedAsIdenticalUser });
  }

  /**
   * Update cognitoSetting
   */
  async updateCognitoSetting() {
    const {
      cognitoClientId, cognitoUserPoolId, cognitoRegion, isSameUsernameTreatedAsIdenticalUser,
    } = this.state;

    let requestParams = {
      cognitoClientId, cognitoUserPoolId, cognitoRegion, isSameUsernameTreatedAsIdenticalUser,
    };

    requestParams = await removeNullPropertyFromObject(requestParams);
    const response = await apiv3Put('/security-setting/cognito', requestParams);
    const { securitySettingParams } = response.data;

    this.setState({
      cognitoClientId: securitySettingParams.cognitoClientId,
      cognitoUserPoolId: securitySettingParams.cognitoUserPoolId,
      congitoRegion: securitySettingParams.cognitoRegion,
      isSameUsernameTreatedAsIdenticalUser: securitySettingParams.isSameUsernameTreatedAsIdenticalUser,
    });
    return response;
  }

}
