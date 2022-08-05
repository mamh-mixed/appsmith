package com.appsmith.testcache;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.appsmith.testcache.model.TestModel;
import com.appsmith.testcache.service.CacheTestService;

import reactor.core.publisher.Mono;

@RestController("/")
public class TestController {
    
    @Autowired
    private CacheTestService cacheTestService;

    @GetMapping("/test/{id}")
    Mono<TestModel> getTestModel(@PathVariable("id") String id) {
        return cacheTestService.getObjectFor(id);
    }
}
