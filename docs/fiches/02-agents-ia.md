# Fiche 02 — Travailler avec des agents IA

## Ce qu'est un agent dans Claude Code

Un agent (ou sous-agent) est un fichier Markdown dans `.claude/agents/`. Il définit un assistant spécialisé que la session principale peut appeler pour une tâche.

```markdown
---
name: chef-de-projet        # identifiant
description: Transforme…    # QUAND l'utiliser : c'est ce que lit la session principale pour décider de l'appeler
tools: Read, Grep, Glob     # outils autorisés (si absent : tous)
model: opus                 # modèle utilisé
---
Le prompt système de l'agent.
```

## Les trois propriétés à retenir

1. **Contexte séparé.** L'agent démarre sans rien connaître de la conversation. Il ne reçoit que son prompt système, le message de la tâche et `CLAUDE.md`. Il ne renvoie que sa réponse finale.
2. **Outils limités.** On ne donne à chaque rôle que ce dont il a besoin (principe du moindre privilège). Le chef de projet ne peut pas exécuter de commande ; il ne peut écrire que parce qu'il doit produire la spécification.
3. **Modèle au choix.** Un modèle puissant pour le raisonnement (cadrage, architecture), un modèle plus rapide et moins cher pour l'exécution répétitive.

## Conséquences pratiques

- **Un agent ne peut pas appeler un autre agent.** Le chef de projet ne « dirige » donc pas les autres : c'est la session principale qui orchestre. Le chef de projet cadre et spécifie.
- **Les agents ne se parlent pas.** Ils communiquent par des fichiers : la spécification dans `docs/specs/` est le contrat que lisent le développeur, le rédacteur de tests et le QA.
- **Ce qui est commun va dans `CLAUDE.md`**, ce qui est propre à un rôle va dans le fichier de l'agent.

## Bonnes pratiques de rédaction

- Expliquer le **pourquoi** des consignes, pas seulement la règle : l'agent généralise mieux.
- Décrire la **forme du résultat attendu** (sections, format des critères).
- Dire **ce qui est hors de son rôle** (ici : ne pas choisir l'implémentation, ne pas toucher au code).
- Lui donner une **sortie de secours** en cas de doute (ici : la section « Questions ouvertes ») pour éviter qu'il invente.
- Soigner la `description` : trop vague, l'agent n'est jamais appelé ; trop large, il l'est à tort.

## Pourquoi séparer les rôles

- Celui qui écrit le code ne doit pas être seul à juger s'il est correct : un agent de test ou de QA qui part de la spécification, et non du code, détecte les écarts au lieu de les confirmer.
- Chaque agent garde un contexte court et centré, donc de meilleurs résultats.
- Le coût : chaque agent repart de zéro et relit le projet. Pour une petite modification, la session principale seule est plus efficace.

## Questions d'entretien

**Comment utilisez-vous l'IA dans votre travail de développeur ?**
Réponse type : je cadre d'abord (spécification avec critères d'acceptation vérifiables), je fais développer par petites tâches, je fais écrire les tests à partir de la spécification et non du code, et je relis tout ce qui est fusionné. L'IA accélère l'exécution ; la responsabilité du résultat reste la mienne.

**Quels sont les risques du code généré par IA, et comment les réduire ?**
API obsolètes ou inventées (donner la doc de la version installée), code plausible mais faux (tests et revue), dérive de périmètre (tâches petites et critères explicites), failles de sécurité (revue ciblée sur l'authentification et l'accès aux données).

**Qu'est-ce qu'un bon critère d'acceptation ?**
Un énoncé vérifiable sans interprétation, par exemple au format « Étant donné / quand / alors ». S'il ne peut pas devenir un test, il est trop flou.
