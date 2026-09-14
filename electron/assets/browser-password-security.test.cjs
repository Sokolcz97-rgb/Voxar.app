"use strict";

const assert = require("node:assert/strict");
const {
  normalizeOrigin,
  isSecureAutofillOrigin,
  csvCredentials,
  generateStrongPassword,
} = require("./browser-password-security.cjs");

assert.equal(normalizeOrigin("github.com/login"), "https://github.com");
assert.equal(normalizeOrigin("https://Example.COM:8443/path?q=1"), "https://example.com:8443");
assert.equal(normalizeOrigin("javascript:alert(1)"), null);
assert.equal(normalizeOrigin("file:///C:/secret.txt"), null);

assert.equal(isSecureAutofillOrigin("https://example.com"), true);
assert.equal(isSecureAutofillOrigin("http://example.com"), false);
assert.equal(isSecureAutofillOrigin("http://localhost:3000"), true);
assert.equal(isSecureAutofillOrigin("http://127.0.0.1:8080"), true);

const edgeCsv = [
  "name,url,username,password",
  'GitHub,https://github.com/login,user@example.com,"p,ass"',
].join("\n");
const edge = csvCredentials(edgeCsv, "edge");
assert.equal(edge.length, 1);
assert.deepEqual(edge[0], {
  origin: "https://github.com",
  username: "user@example.com",
  password: "p,ass",
  source: "edge",
});

const operaCsv = [
  "name,url,username,password,note",
  'Example,https://example.com/account,edy,"A""quoted""Pass!",',
].join("\n");
const opera = csvCredentials(operaCsv, "opera-gx");
assert.equal(opera.length, 1);
assert.equal(opera[0].origin, "https://example.com");
assert.equal(opera[0].username, "edy");
assert.equal(opera[0].password, 'A"quoted"Pass!');

for (let i = 0; i < 25; i += 1) {
  const password = generateStrongPassword(22);
  assert.equal(password.length, 22);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[^A-Za-z0-9]/);
}
assert.equal(generateStrongPassword(2).length, 16, "generator must enforce a strong minimum length");
assert.equal(generateStrongPassword(200).length, 64, "generator must cap extreme requested lengths");

console.log("✓ VoxarioBrowser secure password helpers passed");
