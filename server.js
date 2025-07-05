import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '10s',
};

export default function () {
  // 1. GET
  let res = http.get('http://localhost:3000/usuarios');
  check(res, {
    'GET /usuarios retorna 200': (r) => r.status === 200,
  });

  // 2. POST
  res = http.post('http://localhost:3000/usuarios', JSON.stringify({
    nome: "Teste",
    email: "teste@example.com"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    'POST /usuarios retorna 201': (r) => r.status === 201,
  });

  // Pegando o ID do usuário criado para usar nas próximas chamadas
  const id = res.json().id;

  // 3. PUT
  res = http.put(`http://localhost:3000/usuarios/${id}`, JSON.stringify({
    nome: "Atualizado",
    email: "atualizado@example.com"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    'PUT /usuarios/:id retorna 200': (r) => r.status === 200,
  });

  // 4. DELETE
  res = http.del(`http://localhost:3000/usuarios/${id}`);
  check(res, {
    'DELETE /usuarios/:id retorna 204': (r) => r.status === 204,
  });
}
