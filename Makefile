#
# Run all tests
#

docco = ./node_modules/docco/bin/docco

check test:
	mocha -R spec -t 10000

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
