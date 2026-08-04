# Changelog

Todas as mudanças notáveis do projeto são documentadas aqui.

## 2026-08-04

### Adicionado
- Cliente agora pode excluir um arquivo que ele mesmo enviou, na tela do projeto no portal.
- Barra de progresso do projeto agora aparece também na tela de detalhe do projeto no portal do cliente (antes só aparecia na listagem).
- Empresas, projetos e colaboradores sem foto/logo agora mostram um avatar com as iniciais em vez de um ícone genérico.
- Campo para editar o nome do projeto na aba "Visão Geral" do admin (o nome da empresa já podia ser editado em Empresas).
- Tela de erro 404 para rotas inexistentes (antes redirecionava direto para a home).
- Exclusão de empresa agora lista os projetos e colaboradores vinculados com uma caixa de seleção por item: marque para excluir junto, deixe desmarcado para apenas desvincular (o projeto/conta continua existindo, só perde o vínculo com a empresa).
- Excluir uma conta agora também remove o login no Firebase Authentication automaticamente (via Cloud Function), não só o cadastro na plataforma.
- `public/_redirects` para o SPA funcionar corretamente também se hospedado no Netlify (o 404 ao recarregar a página era falta dessa regra — no Firebase Hosting isso já funcionava).

### Alterado
- Nomes dos papéis de acesso traduzidos para português: Owner → Proprietário, Manager → Gerente, Client → Cliente.
- Peso de cada etapa da Linha do Tempo do projeto agora é calculado automaticamente a partir do intervalo de dias entre as datas das etapas (a primeira etapa é medida a partir da criação do projeto), em vez de um controle manual de peso (%). O campo de data virou um seletor de data real.

### Infraestrutura
- Adicionado Cloud Functions (`functions/`) para operações que exigem o Admin SDK do Firebase (hoje, exclusão de usuário no Authentication). Requer o projeto Firebase estar no plano Blaze.
