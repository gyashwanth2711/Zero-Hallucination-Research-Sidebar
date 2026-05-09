import json
from prefab_ui.app import PrefabApp
from prefab_ui.components import Card, CardHeader, CardTitle

app = PrefabApp(css_class='max-w-md mx-auto p-4')
with app:
    Card(children=[CardHeader(children=[CardTitle('Hello')])])
print(app.to_json())
