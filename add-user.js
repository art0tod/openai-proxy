const bcrypt = require('bcryptjs');
const fs = require('fs');

if (process.argv.length < 4) {
    console.log("Usage: node add-user.js <username> <password>");
    process.exit(1);
}

const username = process.argv[2];
const password = process.argv[3];

const usersFile = 'users.txt';

let users = [];
if (fs.existsSync(usersFile)) {
    users = fs.readFileSync(usersFile, 'utf-8')
        .split('\n')
        .filter(line => line)
        .map(line => {
            const [usr, hash] = line.split(',');
            return { username: usr, passwordHash: hash };
        });
}


if (users.find(u => u.username === username)) {
    console.log(`Error: user "${username}" already exists!`);
    process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
    fs.appendFileSync(usersFile, `\n${username},${hash}`);
    console.log(`User "${username}" added!`);
});
