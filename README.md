
Capsula
=======

**Encapsulated Command Execution**

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://github.com/rse)
<br/>
[![npm (project release)](https://img.shields.io/npm/v/capsula?logo=npm&label=npm%20release&color=%23cc3333)](https://npmjs.com/capsula)
[![npm (project downloads)](https://img.shields.io/npm/dm/capsula?logo=npm&label=npm%20downloads&color=%23cc3333)](https://npmjs.com/capsula)

Abstract
--------

Capsula is a utility program for executing a Linux command in the
current working directory from within an encapsulated environment
based on a Docker container. The crux is that the Capsula container
environment provides a special filesystem layout to the command, which
mimicks the host filesystem paths as close as possible, but prevents
access to non-relevant areas of the user's home directory and persists
changes to the areas outside the user's home directory.

Installation
------------

```
$ npm install -g capsula
```

Usage
-----

See the [Unix manual page capsula(8)](src/capsula.md) for usage details.

License
-------

Copyright &copy; 2025 Dr. Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

