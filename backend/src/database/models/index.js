const User = require('./User');
const Session = require('./Session');
const OTP = require('./OTP');
const Device = require('./Device');
const Chat = require('./Chat');
const ChatParticipant = require('./ChatParticipant');
const Message = require('./Message');
const MessageReaction = require('./MessageReaction');
const MessageDraft = require('./MessageDraft');
const PinnedMessage = require('./PinnedMessage');
const ScheduledMessage = require('./ScheduledMessage');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const GroupRole = require('./GroupRole');
const GroupInviteLink = require('./GroupInviteLink');
const GroupJoinRequest = require('./GroupJoinRequest');
const GroupTopic = require('./GroupTopic');
const Channel = require('./Channel');
const ChannelSubscriber = require('./ChannelSubscriber');
const Poll = require('./Poll');
const PollVote = require('./PollVote');
const File = require('./File');
const UploadSession = require('./UploadSession');
const Notification = require('./Notification');
const NotificationDevice = require('./NotificationDevice');
const AdminUser = require('./AdminUser');
const AdminRole = require('./AdminRole');
const AdminPermission = require('./AdminPermission');
const AdminAuditLog = require('./AdminAuditLog');
const FeatureFlag = require('./FeatureFlag');
const SystemSetting = require('./SystemSetting');
const Language = require('./Language');
const Report = require('./Report');
const IPManagement = require('./IPManagement');
const Webhook = require('./Webhook');

// Relationships
// User - Session
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User - Device
User.hasMany(Device, { foreignKey: 'user_id', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Chat - Message
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// User - Message
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sent_messages' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// Chat - Participant
Chat.belongsToMany(User, { through: ChatParticipant, foreignKey: 'chat_id', as: 'participants' });
User.belongsToMany(Chat, { through: ChatParticipant, foreignKey: 'user_id', as: 'chats' });

// Group - Member
Group.belongsToMany(User, { through: GroupMember, foreignKey: 'group_id', as: 'members' });
User.belongsToMany(Group, { through: GroupMember, foreignKey: 'user_id', as: 'groups' });

// Channel - Subscriber
Channel.belongsToMany(User, { through: ChannelSubscriber, foreignKey: 'channel_id', as: 'subscribers' });
User.belongsToMany(Channel, { through: ChannelSubscriber, foreignKey: 'user_id', as: 'channels' });

module.exports = {
    User,
    Session,
    OTP,
    Device,
    Chat,
    ChatParticipant,
    Message,
    MessageReaction,
    MessageDraft,
    PinnedMessage,
    ScheduledMessage,
    Group,
    GroupMember,
    GroupRole,
    GroupInviteLink,
    GroupJoinRequest,
    GroupTopic,
    Channel,
    ChannelSubscriber,
    Poll,
    PollVote,
    File,
    UploadSession,
    Notification,
    NotificationDevice,
    AdminUser,
    AdminRole,
    AdminPermission,
    AdminAuditLog,
    FeatureFlag,
    SystemSetting,
    Language,
    Report,
    IPManagement,
    Webhook
};