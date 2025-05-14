# Reconhecimento Facial com Face API
- Customizado para o projeto **Pixelvivo**.

Este projeto é uma aplicação web para reconhecimento facial seguro, desenvolvida para a Pixelvivo, que utiliza a biblioteca Face API e inclui detecção de vivacidade (liveness) para assegurar que o usuário está presente e consciente durante o reconhecimento.

## Funcionalidades

- **Cadastro de Usuários**: Envio de imagens faciais e registro de nomes associados.
- **Reconhecimento Facial em Tempo Real**: Usa a câmera do dispositivo para detectar e reconhecer rostos cadastrados.
- **Detecção de Vivacidade (Liveness Check)**: Verifica sorrisos para confirmar que o rosto capturado é de uma pessoa viva, prevenindo ataques de fotos ou vídeos.
- **Opções Configuráveis**: Permite habilitar/desabilitar a caixa de reconhecimento facial e a exibição de nomes na interface.
- **Interface Intuitiva**: Design responsivo e focado em segurança.

## Tecnologias Utilizadas

- **HTML5**: Estrutura semântica da aplicação.
- **CSS3**: Estilização avançada, incluindo cantos arredondados e efeitos de sombra.
- **JavaScript**: Lógica de cadastro, detecção e reconhecimento facial, implementação de configurações dinâmicas.
- **Bootstrap 5**: Componentes e layout responsivo.
- **TensorFlow.js**: Engine de aprendizado de máquina executada no navegador.
- **Face API**: Framework para detecção de faces, extração de landmarks e reconhecimento.
- **Face Expression Net**: Utilizado para o **liveness check**, detectando expressões faciais como sorriso.

## Como Funciona

1. **Cadastro de Usuários**:
   - Envie uma imagem e associe-a a um nome.
   - O sistema extrai descritores faciais e armazena para comparações futuras.

2. **Reconhecimento Facial**:
   - Ative a câmera; o sistema desenha uma caixa ao redor do rosto detectado.
   - Se configurado, exibe o nome acima da caixa de reconhecimento.
   - Antes do reconhecimento, o liveness check solicita que o usuário sorria para validação.

3. **Feedback e Segurança**:
   - Mensagens indicam status de vivacidade e resultados de reconhecimento.
   - Opções nas configurações permitem personalizar threshold de correspondência, vivacidade e exibição de caixas.

## Estrutura do Projeto

- **index.html**: Layout principal e modais de cadastro/configurações.
- **styles.css**: Temas de interface e estilos de caixas de reconhecimento.
- **scripts.js**: Lógica de inicialização, cadastro, detecção e reconhecimento.
- **models/**: Modelos da Face API e redes para detecção e reconhecimento.

## Requisitos

- Navegador com suporte a JavaScript e acesso à câmera.
- Modelos da Face API disponíveis na pasta `./models/`.

## Como Usar

1. Clone o repositório e abra o arquivo `index.html` em um navegador.
2. Certifique-se de que os modelos da Face API estão na pasta `./models/`.
3. Use a interface para cadastrar usuários e iniciar o reconhecimento facial.

## Observações

- Certifique-se de conceder permissão para o uso da câmera no navegador.
- Para melhor desempenho, utilize imagens de boa qualidade e iluminação adequada.

---
*Atualização: mudança implementada para o projeto da Pixelvivo.*