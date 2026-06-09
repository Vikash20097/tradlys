const fs = require('fs');
const path = require('path');

const USER_STORE_PATH = path.join(__dirname, '..', 'payments_users.json');

const getStoredUsers = () => {
  try {
    if (fs.existsSync(USER_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(USER_STORE_PATH, 'utf8'));
    }
  } catch (e) { console.error('userStore read error:', e); }
  return {};
};

const setStoredUsers = (data) => {
  try {
    fs.writeFileSync(USER_STORE_PATH, JSON.stringify(data, null, 2));
  } catch (e) { console.error('userStore write error:', e); }
};

const upsertUser = (uid, data) => {
  const users = getStoredUsers();
  if (!users[uid]) users[uid] = { uid, ...data };
  else Object.assign(users[uid], data);
  setStoredUsers(users);
  return users[uid];
};

const findUser = (uid) => getStoredUsers()[uid] || null;

module.exports = { getStoredUsers, setStoredUsers, upsertUser, findUser };
