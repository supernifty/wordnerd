# -*- coding: utf-8 -*-
'''
    main web interface
'''
import os
import re
import shutil

import flask

import config
import proxy

app = flask.Flask(__name__, template_folder='templates')
app.config.from_pyfile('config.py')
app.secret_key = 'ducks in space'
app.wsgi_app = proxy.ReverseProxied(app.wsgi_app)

@app.route('/init')
def init():
    pass

@app.route('/', methods=['GET', 'POST'])
def main():
    '''
        main entry point
    '''
    return flask.render_template('main.html')

if __name__ == '__main__':
    app.run(port=config.PORT)
