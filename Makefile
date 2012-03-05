#
# Run all tests
#

docco = ./node_modules/docco/bin/docco

test:
	mocha -R spec

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
