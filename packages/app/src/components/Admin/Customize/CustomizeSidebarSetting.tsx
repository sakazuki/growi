import React, { useState, useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { Card, CardBody } from 'reactstrap';

import { isDarkMode as isDarkModeByUtil } from '~/client/util/color-scheme';

const CustomizeSidebarsetting = (): JSX.Element => {
  const { t } = useTranslation();
  const [isDrawerMode, setIsDrawerMode] = useState(false);
  const [isDefaultOpenAtDockMode, setIsDefaultOpenAtDockMode] = useState(false);

  const isDarkMode = isDarkModeByUtil();
  const colorText = isDarkMode ? 'dark' : 'light';

  const onClickSubmit = () => {
    console.log('update!');
  };

  return (
    <React.Fragment>
      <div className="row">
        <div className="col-12">

          <h2 className="admin-setting-header">{t('admin:customize_setting.default_sidebar_mode.title')}</h2>

          <Card className="card well my-3">
            <CardBody className="px-0 py-2">
              {t('admin:customize_setting.default_sidebar_mode.desc')}
            </CardBody>
          </Card>

          <div className="d-flex justify-content-around mt-5">
            <div id="layoutOptions" className="card-deck">
              <div
                className={`card customize-layout-card ${isDrawerMode ? 'border-active' : ''}`}
                onClick={() => setIsDrawerMode(true)}
                role="button"
              >
                <img src={`/images/customize-settings/drawer-${colorText}.svg`} />
                <div className="card-body text-center">
                  Drawer Mode
                </div>
              </div>
              <div
                className={`card customize-layout-card ${!isDrawerMode ? 'border-active' : ''}`}
                onClick={() => setIsDrawerMode(false)}
                role="button"
              >
                <img src={`/images/customize-settings/dock-${colorText}.svg`} />
                <div className="card-body  text-center">
                  Dock Mode
                </div>
              </div>
            </div>
          </div>

          <Card className="card well my-5">
            <CardBody className="px-0 py-2">
              {t('admin:customize_setting.default_sidebar_mode.dock_mode_default_desc')}
            </CardBody>
          </Card>

          <div className="d-flex flex-column align-items-center">
            <div className="custom-control custom-radio my-3">
              <input
                type="radio"
                id="radio-email-show"
                className="custom-control-input"
                name="mailVisibility"
                checked={!isDrawerMode && isDefaultOpenAtDockMode}
                disabled={isDrawerMode}
                onChange={() => { setIsDefaultOpenAtDockMode(true) }}
              />
              <label className="custom-control-label" htmlFor="radio-email-show">
                {t('admin:customize_setting.default_sidebar_mode.dock_mode_default_open')}
              </label>
            </div>
            <div className="custom-control custom-radio my-3">
              <input
                type="radio"
                id="radio-email-show"
                className="custom-control-input"
                name="mailVisibility"
                checked={!isDrawerMode && !isDefaultOpenAtDockMode}
                disabled={isDrawerMode}
                onChange={() => { setIsDefaultOpenAtDockMode(false) }}
              />
              <label className="custom-control-label" htmlFor="radio-email-show">
                {t('admin:customize_setting.default_sidebar_mode.dock_mode_default_close')}
              </label>
            </div>
          </div>

          <div className="row my-3">
            <div className="mx-auto">
              <button type="button" onClick={onClickSubmit} className="btn btn-primary">{ t('Update') }</button>
            </div>
          </div>

        </div>
      </div>
    </React.Fragment>
  );
};

export default CustomizeSidebarsetting;
