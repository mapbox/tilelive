#
# Run all tests
#

docco = ./node_modules/docco/bin/docco

test:
	./node_modules/mocha/bin/_mocha -R spec -t 10000

check: test

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
