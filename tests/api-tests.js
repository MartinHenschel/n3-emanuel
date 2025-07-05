import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Configurações básicas
const BASE_URL = 'http://localhost:3000';
const USER_COUNT = 10;       // Número de usuários virtuais
const TEST_DURATION = '30s'; // Duração do teste

// Métricas personalizadas
const getDuration = new Trend('get_duration');
const postDuration = new Trend('post_duration');
const putDuration = new Trend('put_duration');
const deleteDuration = new Trend('delete_duration');
const successRate = new Rate('success_rate');
const errors = new Counter('errors');

// Gerar dados de usuário únicos
function generateUser(vu) {
  return {
    nome: `User_${vu}_${Date.now()}`,
    email: `user_${vu}_${Date.now()}@test.com`
  };
}

// Configuração do teste
export const options = {
  stages: [
    { duration: '10s', target: USER_COUNT },  // Rampa de subida
    { duration: TEST_DURATION, target: USER_COUNT },  // Carga constante
    { duration: '10s', target: 0 },  // Rampa de descida
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% das reqs < 500ms
    'success_rate': ['rate>0.95'],       // Taxa de sucesso > 95%
    'errors': ['count<10']               // Menos de 10 erros
  }
};

// IDs criados durante o teste
let createdIds = [];

// Função principal executada por cada usuário virtual
export default function() {  // <-- Esta é a função principal que o K6 precisa
  const vu = __VU; // ID do usuário virtual atual
  
  // 1. POST - Criar novo usuário
  const newUser = generateUser(vu);
  const postRes = http.post(
    `${BASE_URL}/usuarios`,
    JSON.stringify(newUser),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  // Registrar métricas e verificar sucesso
  postDuration.add(postRes.timings.duration);
  const postSuccess = check(postRes, {
    'POST status 201': (r) => r.status === 201,
    'POST tem ID': (r) => r.json().id !== undefined
  });
  
  if (postSuccess) {
    createdIds.push(postRes.json().id);
    successRate.add(true);
  } else {
    errors.add(1);
    successRate.add(false);
    return; // Se falhar, não continua
  }
  
  // 2. GET - Listar todos os usuários
  const getRes = http.get(`${BASE_URL}/usuarios`);
  getDuration.add(getRes.timings.duration);
  const getSuccess = check(getRes, {
    'GET status 200': (r) => r.status === 200,
    'GET lista contém novo usuário': (r) => {
      const users = r.json();
      return Array.isArray(users) && users.some(u => u.id === createdIds[createdIds.length - 1]);
    }
  });
  
  successRate.add(getSuccess);
  if (!getSuccess) errors.add(1);
  
  // 3. PUT - Atualizar um usuário aleatório
  if (createdIds.length > 0) {
    const randomId = createdIds[Math.floor(Math.random() * createdIds.length)];
    const updatedUser = {
      nome: `Updated_${Date.now()}`,
      email: `updated_${Date.now()}@test.com`
    };
    
    const putRes = http.put(
      `${BASE_URL}/usuarios/${randomId}`,
      JSON.stringify(updatedUser),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    putDuration.add(putRes.timings.duration);
    const putSuccess = check(putRes, {
      'PUT status 200': (r) => r.status === 200,
      'PUT atualizou nome': (r) => {
        const user = r.json();
        return user && user.nome === updatedUser.nome;
      }
    });
    
    successRate.add(putSuccess);
    if (!putSuccess) errors.add(1);
  }
  
  // 4. DELETE - Remover um usuário (último criado)
  if (createdIds.length > 0) {
    const userId = createdIds.pop();
    const delRes = http.del(`${BASE_URL}/usuarios/${userId}`);
    deleteDuration.add(delRes.timings.duration);
    
    // VERIFICAÇÃO CORRETA - STATUS 204
    const delSuccess = check(delRes, {
      'DELETE status 204': (r) => r.status === 204
    });
    
    successRate.add(delSuccess);
    if (!delSuccess) errors.add(1);
  }
  
  // Intervalo entre operações
  sleep(1);
}