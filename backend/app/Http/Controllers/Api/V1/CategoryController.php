<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Category::query();
        if ($request->has('is_active'))   $q->where('is_active', $request->boolean('is_active'));
        if ($request->has('department')) {
            is_array($request->department)
                ? $q->whereIn('department', $request->department)
                : $q->where('department', $request->department);
        }
        return CategoryResource::collection($q->orderBy('sort_order')->get());
    }

    public function show(Category $category): CategoryResource
    {
        return new CategoryResource($category);
    }

    public function store(StoreCategoryRequest $request): CategoryResource
    {
        $category = Category::create($request->validated());
        $this->logActivity('CATEGORY_CREATED', "Categoria '{$category->name}' creata", $category);
        return new CategoryResource($category);
    }

    public function update(UpdateCategoryRequest $request, Category $category): CategoryResource
    {
        $category->update($request->validated());
        $this->logActivity('CATEGORY_UPDATED', "Categoria '{$category->name}' aggiornata", $category);
        return new CategoryResource($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->dishes()->exists()) {
            return response()->json(['message' => 'Impossibile eliminare: categoria con piatti associati'], 422);
        }
        if ($category->department === 'carta_vini' && $category->wines()->exists()) {
            return response()->json(['message' => 'Impossibile eliminare: categoria con vini associati'], 422);
        }
        $this->logActivity('CATEGORY_DELETED', "Categoria '{$category->name}' eliminata", $category);
        $category->delete();
        return response()->json(null, 204);
    }

    public function toggle(Category $category): CategoryResource
    {
        $category->update(['is_active' => !$category->is_active]);
        $this->logActivity('CATEGORY_TOGGLED',
            "Categoria '{$category->name}' " . ($category->is_active ? 'attivata' : 'disattivata'),
            $category
        );
        return new CategoryResource($category);
    }
}
