from app.services.nutrition.usda_client import UsdaNotFoundError, UsdaUnavailableError
from app.tests import usda_samples as samples


class FakeUsda:
    def __init__(self):
        self.unavailable = False
        self.search_calls = []
        self.food_calls = []
        self.foods = {171287: samples.EGG_SEARCH_ITEM, 168878: samples.RICE_DETAIL}

    def search(self, query, page, page_size, data_types):
        self.search_calls.append((query, page, page_size, data_types))
        if self.unavailable:
            raise UsdaUnavailableError("down")
        return samples.SEARCH_RESPONSE

    def get_food(self, fdc_id):
        self.food_calls.append(fdc_id)
        if self.unavailable:
            raise UsdaUnavailableError("down")
        if fdc_id not in self.foods:
            raise UsdaNotFoundError(str(fdc_id))
        return self.foods[fdc_id]


class FakeAi:
    """Stands in for OpenAI in tests. Set `outputs[SomeOutputModel]` to an instance, an exception to
    raise, or a function of the input text. Every call is recorded in `calls`."""

    def __init__(self):
        self.outputs: dict = {}
        self.calls: list[dict] = []

    def parse(self, *, instructions, input_text, output_model):
        from app.services.ai.client import AiUnavailableError

        self.calls.append(
            {"instructions": instructions, "input": input_text, "model": output_model}
        )
        out = self.outputs.get(output_model)
        if isinstance(out, Exception):
            raise out
        if callable(out):
            out = out(input_text)
        if out is None:
            raise AiUnavailableError("no fake output configured")
        return out

    @property
    def last_input(self) -> str:
        return self.calls[-1]["input"]
