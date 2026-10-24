-- Ashes of Eryon 0.10.0: jih mapy – Solný průsmyk (pass) a Rudé písky (sands).
create or replace function public.ashes_region_enemies()
returns jsonb language sql immutable as $$
  select $j${
    "kalidra":{
      "shore":[{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[1,2]},{"id":"pasarak","n":"Pašerák z útesů","c":"lucistnik","l":[1,2]}],
      "aqueduct":[{"id":"lapka","n":"Lapka od akvaduktu","c":"hoplit","l":[2,3]},{"id":"kultista","n":"Kultista popela","c":"vestec","l":[2,3]}],
      "hills":[{"id":"zved-legie","n":"Zvěd Rudého slunce","c":"lucistnik","l":[3,5]},{"id":"predvoj","n":"Předvoj legie","c":"hoplit","l":[3,5]}],
      "plain":[{"id":"kopinik","n":"Kopiník Rudého slunce","c":"hoplit","l":[4,6]},{"id":"knez-slunce","n":"Kněz Rudého slunce","c":"vestec","l":[4,6]}],
      "cove":[{"id":"strazce-lodi","n":"Strážce černých lodí","c":"hoplit","l":[5,7]}],
      "camp":[{"id":"garda","n":"Azkarova garda","c":"hoplit","l":[6,8]}],
      "pass":[{"id":"lapka-prusmyku","n":"Lapka ze Solného průsmyku","c":"lucistnik","l":[3,5]},{"id":"hlidka-slunce","n":"Hlídka Rudého slunce","c":"hoplit","l":[3,5]}],
      "sands":[{"id":"nomad","n":"Nomád rudých písků","c":"hoplit","l":[5,7]},{"id":"vestec-slunce","n":"Věštec Rudého slunce","c":"vestec","l":[5,7]},{"id":"lucistnik-dun","n":"Lučištník z dun","c":"lucistnik","l":[5,7]}]
    },
    "legie":{
      "cove":[{"id":"strazny-utesy","n":"Strážný z útesů","c":"lucistnik","l":[1,2]},{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[1,2]}],
      "shore":[{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[2,3]},{"id":"rybar","n":"Rybář s harpunou","c":"hoplit","l":[2,3]}],
      "aqueduct":[{"id":"strazce-akvaduktu","n":"Strážce akvaduktu","c":"hoplit","l":[2,3]},{"id":"knezka","n":"Kněžka přílivu","c":"vestec","l":[2,3]}],
      "hills":[{"id":"zved-kalidra","n":"Kalidrský zvěd","c":"lucistnik","l":[3,5]},{"id":"strazce-ohne","n":"Strážce ohně","c":"hoplit","l":[3,5]}],
      "plain":[{"id":"obrance","n":"Obránce Kalidry","c":"hoplit","l":[4,6]},{"id":"knez-kalidry","n":"Kněz Kalidry","c":"vestec","l":[4,6]}],
      "kalidra":[{"id":"straz-kalidry","n":"Stráž Kalidry","c":"hoplit","l":[6,8]}],
      "pass":[{"id":"lapka-prusmyku","n":"Lapka ze Solného průsmyku","c":"lucistnik","l":[3,5]},{"id":"pruzkumnik-kalidry","n":"Kalidrský průzkumník","c":"lucistnik","l":[3,5]}],
      "sands":[{"id":"nomad","n":"Nomád rudých písků","c":"hoplit","l":[5,7]},{"id":"strazce-ruin","n":"Strážce Starého slunce","c":"vestec","l":[5,7]},{"id":"lucistnik-dun","n":"Lučištník z dun","c":"lucistnik","l":[5,7]}]
    }
  }$j$::jsonb;
$$;
