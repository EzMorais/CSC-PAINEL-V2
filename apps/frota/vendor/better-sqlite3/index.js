'use strict';
/**
 * Adaptador que expõe a API do better-sqlite3 usando o `node:sqlite` embutido
 * no Node. O sistema deixa de depender de módulo nativo compilado — nada de
 * prebuild, node-gyp ou Visual Studio Build Tools no servidor.
 *
 * Só o subconjunto usado pelo Drizzle está implementado.
 * Requer Node 22.5+ (o node:sqlite é estável a partir do Node 24).
 */
const { DatabaseSync } = require('node:sqlite');

class Declaracao {
  constructor(stmt) {
    this._stmt = stmt;
    this._modoArray = false;
  }

  // O Drizzle liga este modo para receber arrays posicionais em vez de objetos,
  // evitando colisão de nomes de coluna em consultas com junção.
  raw(ligar = true) {
    this._modoArray = ligar;
    this._stmt.setReturnArrays(ligar);
    return this;
  }

  run(...params) {
    const r = this._stmt.run(...params);
    return {
      changes: Number(r.changes),
      lastInsertRowid: Number(r.lastInsertRowid),
    };
  }

  all(...params) {
    return this._stmt.all(...params);
  }

  get(...params) {
    return this._stmt.get(...params);
  }

  values(...params) {
    const antes = this._modoArray;
    if (!antes) this._stmt.setReturnArrays(true);
    const linhas = this._stmt.all(...params);
    if (!antes) this._stmt.setReturnArrays(false);
    return linhas;
  }

  columns() {
    return this._stmt.columns().map((c) => ({ name: c.name }));
  }
}

class Database {
  constructor(caminho = ':memory:') {
    if (typeof DatabaseSync !== 'function') {
      throw new Error(
        'Este Node não tem o módulo node:sqlite. Use Node 22.5 ou superior ' +
        '(recomendado: Node 24 LTS).'
      );
    }
    this._db = new DatabaseSync(caminho);
    this.name = caminho;
    this.open = true;
  }

  prepare(sql) {
    return new Declaracao(this._db.prepare(sql));
  }

  exec(sql) {
    this._db.exec(sql);
    return this;
  }

  pragma(texto) {
    this._db.exec('PRAGMA ' + texto);
    return this;
  }

  transaction(fn) {
    const db = this._db;
    return (...args) => {
      db.exec('BEGIN');
      try {
        const r = fn(...args);
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };
  }

  close() {
    this._db.close();
    this.open = false;
  }
}

module.exports = Database;
module.exports.default = Database;
