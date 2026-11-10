# DevRescue

**Menos trabalho repetitivo. Mais tempo construindo.**

CLI, GitHub Action e painel para diagnosticar falhas conhecidas em logs, verificar ambiente e preparar correções revisáveis. Sem API paga, conta obrigatória ou execução automática de comandos sugeridos.

[Usar painel](https://brunnojob.github.io/devrescue/) · [Documentação em inglês](README.md) · [Patrocinar](https://github.com/sponsors/brunnojob)

```sh
git clone https://github.com/brunnojob/devrescue.git
cd devrescue
node bin/devrescue.js analyze examples/build.log
node bin/devrescue.js doctor .
node bin/devrescue.js fix .
```

Requer Node.js 22+. O núcleo não tem dependências externas. Detecta 20 famílias de falhas de dependências, TypeScript, Python, Docker, Git, PostgreSQL, testes e rede. Apresenta evidências, localização disponível, repetição e próximos passos. Compara logs e exporta Markdown/JSON.

O autofix da v0.1 é limitado à inclusão explícita de `.env` no `.gitignore`, mediante `fix . --apply ignore-env`, com prévia, backup e verificação de alterações. Diagnósticos genéricos não viram alterações arbitrárias de código.

O painel compartilha o motor da CLI; histórico é local e opcional. Azure PostgreSQL tem API e schema preparados, mas ainda não está conectado. Veja [configuração](docs/AZURE.md).

As regras são heurísticas: não identificam toda falha nem comprovam a causa. Redação de segredos é uma proteção de melhor esforço; revise antes de compartilhar. Consulte [limitações](docs/LIMITATIONS.md).

Patrocínio voluntário ajuda a manter regras e testes. Não garante resultados, receita nem SLA. MIT.
