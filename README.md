LogCroc
-------

LogCroc analyzes your servers log files, determines the status of each of your assets and presents the results as a simple visual dashboard enabling you to take action in real-time.

http://logcroc.com

Dependencies
------------

[Redis]

[Node.js]

[Sass]

Install
-------

Global Prerequisites
````
% npm install -g browserify uglifyify
% gem install sass
````
LogCroc client
````
% cd client/
% npm install
% npm run build
````
LogCroc server
````
% cd server/
% npm install
````

Run
---
````
% cd server/
% npm run start
````
By default LogCroc runs the demo configuration on port **80**, or if NODE_ENV=development is set on port **3000**.

Configure
---------
Modify **/server/accounts.json** to add your own servers.
Additional example can be found in **/server/examples**

TODO
----
1. Accounts configuration database and front-end.
2. Credentials system for accounts.

License
-------

MIT

[Redis]:http://redis.io
[Node.js]:http://nodejs.org
[Sass]:http://sass-lang.com
