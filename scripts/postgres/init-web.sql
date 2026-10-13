-- Yalnız yerel geliştirme. Mevcut rol/veritabanı varsa içeriğini veya şifresini değiştirmez.
-- İlk açılışta Docker çalıştırır; mevcut volume üzerinde de yeniden uygulanabilir.
\set ON_ERROR_STOP on

SELECT 'CREATE ROLE dosso_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ''dosso_web_local'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dosso_web')
\gexec

SELECT 'CREATE ROLE dosso_web_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ''dosso_web_test_local'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dosso_web_test')
\gexec

SELECT 'CREATE DATABASE dosso_dossi_web OWNER dosso_web'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dosso_dossi_web')
\gexec

SELECT 'CREATE DATABASE dosso_dossi_web_test OWNER dosso_web_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dosso_dossi_web_test')
\gexec

REVOKE ALL ON DATABASE dosso_dossi_web FROM PUBLIC;
REVOKE ALL ON DATABASE dosso_dossi_web_test FROM PUBLIC;
GRANT CONNECT ON DATABASE dosso_dossi_web TO dosso_web;
GRANT CONNECT ON DATABASE dosso_dossi_web_test TO dosso_web_test;

\connect dosso_dossi_web
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO dosso_web;

\connect dosso_dossi_web_test
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO dosso_web_test;
