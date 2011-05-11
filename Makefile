#
# Run all tests
#

expresso = ./node_modules/.bin/expresso
docco = ./node_modules/.bin/docco

lint:
	./node_modules/.bin/jshint lib/tilelive/*.js

ifndef only
test:
	$(expresso) -I lib test/*.test.js
else
test:
	$(expresso) -I lib test/${only}.test.js
endif

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
