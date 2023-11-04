/* eslint-disable react/no-danger */
import React from 'react';

import { useTranslation } from 'next-i18next';
import PropTypes from 'prop-types';


import AdminCognitoSecurityContainer from '~/client/services/AdminCognitoSecurityContainer';
import AdminGeneralSecurityContainer from '~/client/services/AdminGeneralSecurityContainer';
import { toastSuccess, toastError } from '~/client/util/toastr';
import { useSiteUrl } from '~/stores/context';

import { withUnstatedContainers } from '../../UnstatedUtils';

class CognitoSecurityManagementContents extends React.Component {

  constructor(props) {
    super(props);

    this.onClickSubmit = this.onClickSubmit.bind(this);
  }

  async onClickSubmit() {
    const { t, adminCognitoSecurityContainer, adminGeneralSecurityContainer } = this.props;

    try {
      await adminCognitoSecurityContainer.updateCognitoSetting();
      await adminGeneralSecurityContainer.retrieveSetupStratedies();
      toastSuccess(t('security_settings.cognito.updated_cognito'));
    }
    catch (err) {
      toastError(err);
    }
  }

  render() {
    const {
      t, adminGeneralSecurityContainer, adminCognitoSecurityContainer, siteUrl,
    } = this.props;
    const { isCognitoEnabled } = adminGeneralSecurityContainer.state;

    return (

      <React.Fragment>

        <h2 className="alert-anchor border-bottom">
          {t('security_settings.cognito.name')}
        </h2>

        {adminCognitoSecurityContainer.state.retrieveError != null && (
          <div className="alert alert-danger">
            <p>{t('Error occurred')} : {adminCognitoSecurityContainer.state.retrieveError}</p>
          </div>
        )}

        <div className="form-group row">
          <div className="col-6 offset-3">
            <div className="custom-control custom-switch custom-checkbox-success">
              <input
                id="isCognitoEnabled"
                className="custom-control-input"
                type="checkbox"
                checked={adminGeneralSecurityContainer.state.isCognitoEnabled || false}
                onChange={() => { adminGeneralSecurityContainer.switchIsCognitoAuthEnabled() }}
              />
              <label className="custom-control-label" htmlFor="isCognitoEnabled">
                {t('security_settings.cognito.enable_cognito')}
              </label>
            </div>
            {(!adminGeneralSecurityContainer.state.setupStrategies.includes('cognito') && isCognitoEnabled)
              && <div className="badge badge-warning">{t('security_settings.setup_is_not_yet_complete')}</div>}
          </div>
        </div>

        {isCognitoEnabled && (
          <React.Fragment>

            <h3 className="border-bottom">{t('security_settings.configuration')}</h3>

            <div className="row mb-5">
              <label htmlFor="cognitoClientId" className="col-3 text-right py-2">{t('security_settings.cognito.client_id')}</label>
              <div className="col-6">
                <input
                  className="form-control"
                  type="text"
                  name="cognitoClientId"
                  value={adminCognitoSecurityContainer.state.cognitoClientId || ''}
                  onChange={e => adminCognitoSecurityContainer.changeCognitoClientId(e.target.value)}
                />
                <p className="form-text text-muted">
                  <small dangerouslySetInnerHTML={{ __html: t('security_settings.Use env var if empty', { env: 'AUTH_COGNITO_CLIENT_ID' }) }} />
                </p>
              </div>
            </div>

            <div className="row mb-5">
              <label htmlFor="cognitoUserPoolId" className="col-3 text-right py-2">{t('security_settings.cognito.user_pool_id')}</label>
              <div className="col-6">
                <input
                  className="form-control"
                  type="text"
                  name="cognitoUserPoolId"
                  defaultValue={adminCognitoSecurityContainer.state.cognitoUserPoolId || ''}
                  onChange={e => adminCognitoSecurityContainer.changeCognitoUserPoolId(e.target.value)}
                />
                <p className="form-text text-muted">
                  <small dangerouslySetInnerHTML={{ __html: t('security_settings.Use env var if empty', { env: 'AUTH_COGNITO_USER_POOL_ID' }) }} />
                </p>
              </div>
            </div>

            <div className="row mb-5">
              <label htmlFor="cognitoRegion" className="col-3 text-right py-2">{t('security_settings.cognito.region')}</label>
              <div className="col-6">
                <input
                  className="form-control"
                  type="text"
                  name="cognitoRegion"
                  defaultValue={adminCognitoSecurityContainer.state.cognitoRegion || ''}
                  onChange={e => adminCognitoSecurityContainer.changeCognitoRegion(e.target.value)}
                />
                <p className="form-text text-muted">
                  <small dangerouslySetInnerHTML={{ __html: t('security_settings.Use env var if empty', { env: 'AUTH_COGNITO_REGION' }) }} />
                </p>
              </div>
            </div>

            <h3 className="alert-anchor border-bottom">
              Attribute Mapping ({t('security_settings.optional')})
            </h3>

            <div className="form-group row">
              <label className="text-left text-md-right col-md-3 col-form-label">
                <strong htmlFor="attrMapUsername">{t('security_settings.form_item_name.attrMapUsername')}</strong>
              </label>
              <div className="col-md-6">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Default: username"
                  name="attrMapUsername"
                  defaultValue={adminCognitoSecurityContainer.state.cognitoAttrMapUsername || ''}
                  onChange={e => adminCognitoSecurityContainer.changeAttrMapUsername(e.target.value)}
                />
                <p className="form-text text-muted">
                  {/* eslint-disable-next-line react/no-danger */}
                  <small dangerouslySetInnerHTML={{ __html: t('security_settings.cognito.username_detail') }} />
                </p>
              </div>
            </div>

            <div className="form-group row">
              <label className="text-left text-md-right col-md-3 col-form-label">
                <strong htmlFor="attrMapMail">{t('security_settings.form_item_name.attrMapMail')}</strong>
              </label>
              <div className="col-md-6">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Default: mail"
                  name="attrMapMail"
                  defaultValue={adminCognitoSecurityContainer.state.cognitoAttrMapMail || ''}
                  onChange={e => adminCognitoSecurityContainer.changeAttrMapMail(e.target.value)}
                />
                <p className="form-text text-muted">
                  <small>
                    {t('security_settings.cognito.mail_detail')}
                  </small>
                </p>
              </div>
            </div>

            <div className="form-group row">
              <label className="text-left text-md-right col-md-3 col-form-label">
                <strong htmlFor="attrMapName">{t('Name')}</strong>
              </label>
              <div className="col-md-6">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Default: name"
                  name="attrMapName"
                  defaultValue={adminCognitoSecurityContainer.state.cognitoAttrMapName || ''}
                  onChange={e => adminCognitoSecurityContainer.changeAttrMapName(e.target.value)}
                />
                <p className="form-text text-muted">
                  <small>
                    {t('security_settings.cognito.name_detail')}
                  </small>
                </p>
              </div>
            </div>

            <h3 className="alert-anchor border-bottom">
              Attribute Mapping Options ({t('security_settings.optional')})
            </h3>

            <div className="row mb-5">
              <div className="offset-3 col-6 text-left">
                <div className="custom-control custom-checkbox custom-checkbox-success">
                  <input
                    id="bindByUserNameCognito"
                    className="custom-control-input"
                    type="checkbox"
                    checked={adminCognitoSecurityContainer.state.isSameUsernameTreatedAsIdenticalUser || false}
                    onChange={() => { adminCognitoSecurityContainer.switchIsSameUsernameTreatedAsIdenticalUser() }}
                  />
                  <label
                    className="custom-control-label"
                    htmlFor="bindByUserNameCognito"
                    dangerouslySetInnerHTML={{ __html: t('security_settings.Treat email matching as identical') }}
                  />
                </div>
                <p className="form-text text-muted">
                  <small dangerouslySetInnerHTML={{ __html: t('security_settings.Treat email matching as identical_warn') }} />
                </p>
              </div>
            </div>

            <div className="row my-3">
              <div className="offset-3 col-5">
                <div className="btn btn-primary" disabled={adminCognitoSecurityContainer.state.retrieveError != null} onClick={this.onClickSubmit}>
                  {t('Update')}
                </div>
              </div>
            </div>

          </React.Fragment>
        )}

      </React.Fragment>

    );
  }

}

const CognitoSecurityManagementContentsFC = (props) => {
  const { t } = useTranslation('admin');
  const { data: siteUrl } = useSiteUrl();
  return <CognitoSecurityManagementContents t={t} siteUrl={siteUrl} {...props} />;
};

/**
 * Wrapper component for using unstated
 */
const CognitoSecurityManagementContentsWrapper = withUnstatedContainers(CognitoSecurityManagementContentsFC, [
  AdminGeneralSecurityContainer,
  AdminCognitoSecurityContainer,
]);

CognitoSecurityManagementContents.propTypes = {
  t: PropTypes.func.isRequired, // i18next
  adminGeneralSecurityContainer: PropTypes.instanceOf(AdminGeneralSecurityContainer).isRequired,
  adminCognitoSecurityContainer: PropTypes.instanceOf(AdminCognitoSecurityContainer).isRequired,
};

export default CognitoSecurityManagementContentsWrapper;
