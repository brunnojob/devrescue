# DevRescue

**Menos ruído nos logs. Evidência clara. Correções para revisar.**

[Ferramenta](https://brunnojob.github.io/devrescue/) · [English](README.md) · [Configurar Azure](docs/AZURE.md) · [Patrocinar](https://github.com/sponsors/brunnojob)

O DevRescue identifica falhas conhecidas em logs, agrupa ocorrências, mostra arquivo/linha quando disponíveis e sugere comandos e etapas de correção. Não executa sugestões nem promete resolver todo erro.

- Análise, diagnóstico com trecho de código informado pelo usuário, comparação, checklist e histórico local opcional.
- Exportação Markdown/JSON, oito temas e idiomas PT/EN.
- Frontend React/Vite diretamente no GitHub Pages, sem iframe ou gateway externo.
- API própria Node.js 22 no Azure: contas, sessões, CSRF, OAuth direto do GitHub com PKCE e verificação de Sponsors.
- PostgreSQL existente `rg-db-wallmarket.postgres.database.azure.com`, com TLS verificado e relatórios isolados por usuário. Logs completos ficam locais; o envio de um resumo revisado é explícito.
- CLI local e GitHub Action para diagnosticar logs; o CLI raiz também verifica a configuração do repositório.

## Executar

```sh
cd apps/web
npm ci
npm run dev
npm test
npm run build
```

O endereço local inclui `/devrescue/`. O CLI raiz usa Node 22 ou superior:

```sh
node bin/devrescue.js analyze examples/build.log --markdown
node bin/devrescue.js doctor .
```

## Publicação

O workflow **GitHub Pages** publica o frontend. A API precisa de um App Service existente, das configurações privadas no Azure e da autorização OIDC para o workflow **Azure API**. Defina `DEVRESCUE_API_URL` nas variáveis do repositório para conectar a interface. Veja os passos exatos em [docs/AZURE.md](docs/AZURE.md).

A configuração do banco e os schemas foram preservados. Nenhuma migração remota é executada pelo deploy. A conectividade real deve ser verificada no runtime; um build verde não comprova conexão. Sem a URL da API, o acesso às contas informa que a configuração está pendente.

GitHub Pages hospeda arquivos estáticos. Pro e Developer Program não transformam o Pages em servidor Node nem garantem créditos Azure. Nenhum recurso pago é criado automaticamente.

O acesso hospedado mantém o teste de três horas por identidade GitHub e acesso de patrocinadores. O código e o CLI local continuam MIT. A remoção de segredos é baseada em padrões: revise os relatórios antes de compartilhar.
