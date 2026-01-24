.PHONY: install serve build clean

PORT ?= 4000

install:
	bundle install

serve:
	bundle exec jekyll serve --port $(PORT) --livereload

build:
	bundle exec jekyll build

clean:
	rm -rf _site .jekyll-cache
