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
