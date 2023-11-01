import React, { useEffect, useCallback } from 'react';

import PropTypes from 'prop-types';

import AdminCognitoSecurityContainer from '~/client/services/AdminCognitoSecurityContainer';
import { toastError } from '~/client/util/toastr';
import { toArrayIfNot } from '~/utils/array-utils';

import { withUnstatedContainers } from '../../UnstatedUtils';


import CognitoSecuritySettingContents from './CognitoSecuritySettingContents';

const CognitoSecurityManagement = (props) => {
  const { adminCognitoSecurityContainer } = props;

  const fetchCognitoSecuritySettingsData = useCallback(async() => {
    try {
      await adminCognitoSecurityContainer.retrieveSecurityData();
    }
    catch (err) {
      const errs = toArrayIfNot(err);
      toastError(errs);
    }
  }, [adminCognitoSecurityContainer]);

  useEffect(() => {
    fetchCognitoSecuritySettingsData();
  }, [adminCognitoSecurityContainer, fetchCognitoSecuritySettingsData]);

  return <CognitoSecuritySettingContents />;
};


CognitoSecurityManagement.propTypes = {
  adminCognitoSecurityContainer: PropTypes.instanceOf(AdminCognitoSecurityContainer).isRequired,
};

const CognitoSecurityManagementWithUnstatedContainer = withUnstatedContainers(CognitoSecurityManagement, [
  AdminCognitoSecurityContainer,
]);

export default CognitoSecurityManagementWithUnstatedContainer;
