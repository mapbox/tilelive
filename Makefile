#
# Run all tests
#

expresso = ./node_modules/expresso/bin/expresso
docco = ./node_modules/docco/bin/docco

ifndef only
test:
	@NODE_PATH=./lib:$NODE_PATH $(expresso) test/*.test.js
else
test:
	@NODE_PATH=./lib:$NODE_PATH $(expresso) test/${only}.test.js
endif

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
