#
# Run all tests
#

docco = ./node_modules/docco/bin/docco

all:
	npm install

clean:
	rm -rf node_modules/*
	: TODO clean docs

test:
	mocha -R spec -t 10000

check: test

doc:
	$(docco) lib/tilelive/*.js

.PHONY: test
