# Reconhecimento Facial com Face API

Este projeto é uma aplicação web para reconhecimento facial utilizando a biblioteca Face API. Ele permite o cadastro de usuários com imagens faciais e realiza o reconhecimento em tempo real utilizando a câmera do dispositivo.

## Funcionalidades

- **Cadastro de Usuários**: Permite o envio de imagens faciais e o registro de nomes associados.
- **Reconhecimento Facial em Tempo Real**: Utiliza a câmera do dispositivo para detectar e reconhecer rostos cadastrados.
- **Interface Intuitiva**: Interface simples e responsiva para facilitar o uso.

## Tecnologias Utilizadas

- **HTML5**: Estrutura da aplicação.
- **CSS3**: Estilização da interface, incluindo uso de classes do Bootstrap.
- **JavaScript**: Lógica da aplicação, manipulação do DOM e integração com bibliotecas.
- **Bootstrap 5**: Framework CSS para design responsivo.
- **TensorFlow.js**: Biblioteca para computação baseada em aprendizado de máquina no navegador.
- **Face API**: Biblioteca para detecção e reconhecimento facial.

## Como Funciona

1. **Cadastro de Usuários**:
   - O usuário pode enviar uma imagem e associá-la a um nome.
   - As informações faciais são processadas e armazenadas para reconhecimento futuro.

2. **Reconhecimento Facial**:
   - A câmera do dispositivo é ativada.
   - O sistema detecta rostos em tempo real e tenta reconhecê-los com base nos dados cadastrados.

3. **Exibição de Resultados**:
   - O sistema exibe mensagens indicando se o rosto foi reconhecido ou não.

## Estrutura do Projeto

- **index.html**: Contém a estrutura principal da aplicação, incluindo o código JavaScript para lógica de cadastro e reconhecimento facial.
- **Modelos**: Os modelos necessários para o funcionamento da Face API devem ser armazenados na pasta `./models/`.

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