<div align="center">

# DevRescue
### Falhas de desenvolvimento, diagnosticadas.

🇺🇸 [English](README.md) · 🇧🇷 Português (BR)

[Abrir no GitHub Pages](https://brunnojob.github.io/devrescue/) · [Abrir a ferramenta](https://brunnojob.github.io/devrescue/tool.html) · [Patrocinar](https://github.com/sponsors/brunnojob)

</div>

Transforme logs de build confusos em evidências e próximos passos práticos.
O acesso hospedado inclui **3 horas de teste grátis** por conta GitHub; depois,
um patrocínio no GitHub Sponsors de **qualquer valor — mensal ativo ou único confirmado**.

## Prévia visual

![DevRescue — transforme logs em um plano de correção](docs/media/preview.jpg)

### Entrada e documentação

![Bancada do DevRescue](docs/media/workbench.jpg)

### Galeria de aparências

![Checklist de ambiente do DevRescue](docs/media/checklist.jpg)

Escolha **inglês ou português** no cabeçalho: navegação, status de acesso, documentação,
diagnósticos e avisos seguem o idioma; evidências originais e comandos não são alterados.
Escolha entre **Graphite, Dim, Midnight, Forest, Light, Mint, Rose ou Sandstone**.

## Início rápido

```sh
git clone https://github.com/brunnojob/devrescue.git
cd devrescue
node bin/devrescue.js analyze examples/build.log
node bin/devrescue.js doctor .
```

Requer Node.js 22+. O núcleo não tem dependências externas.

## O que faz

- **Remove segredos primeiro:** tokens, JWTs, cabeçalhos `Authorization`, senhas e chaves privadas.
- **Detecta e agrupa** falhas de TypeScript, Python, npm, Docker, Git, PostgreSQL, rede e testes, com evidência e localização.
- **Compara dois logs** e exporta relatórios JSON/Markdown só com texto sanitizado.
- **Nunca executa** o texto colado ou comandos sugeridos — revise antes de rodar.

Sincronização com conta é opcional e envia apenas um resumo sanitizado após sua aprovação explícita.
As regras são heurísticas e não garantem resolver todo problema. Veja [limitações](docs/LIMITATIONS.md).

Licença MIT · Apoie em [GitHub Sponsors](https://github.com/sponsors/brunnojob)
