import Page from '~/server/models/page';

module.exports = {
  Page,
  PageTagRelation: require('./page-tag-relation'),
  User: require('./user'),
  ExternalAccount: require('./external-account'),
  UserGroupRelation: require('./user-group-relation'),
  Revision: require('./revision'),
  Tag: require('./tag'),
  Bookmark: require('./bookmark'),
  Comment: require('./comment'),
  Attachment: require('./attachment'),
  GlobalNotificationSetting: require('./GlobalNotificationSetting'),
  GlobalNotificationMailSetting: require('./GlobalNotificationSetting/GlobalNotificationMailSetting'),
  GlobalNotificationSlackSetting: require('./GlobalNotificationSetting/GlobalNotificationSlackSetting'),
  SlackAppIntegration: require('./slack-app-integration'),
};
